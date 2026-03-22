# MIT Hostel Allotment System

I built this specifically to tackle the problem MIT (Manipal Institute of Technology) currently faces every year: a highly stressful, vague, and often opaque hostel allocation process. The goal was to build a system that can handle our complex institutional logic—like CGPA sorting, year-based tiebreakers, and keeping friend groups together—without it turning into a manual spreadsheet nightmare or a random lottery.

The stack is **Next.js (App Router)**, **React**, **PostgreSQL (Neon)**, and **Prisma ORM**.

---

##  Architecture & Assumptions

- **The Setup:** Next.js API routes handle the heavy lifting for the algorithm, while the frontend gives admins an interactive dashboard to run everything.
- **Database:** It's fully relational (`Students` → `StudentGroups` → `Allotments` → `Rooms` → `Blocks`). Instead of constantly wiping the DB to test things, occupancy is calculated dynamically per session. This means you can run multiple separate allotment scenarios (sessions) at the same time and compare them.
- **The Assumptions:** Because MIT doesn't have an open API for exact room layouts, this system uses an assumed seed data map. We generated realistic mock data: specific Block numbers (e.g., Block 14, Block 22), assuming ~8 floors per block, 30 rooms per floor, with varying room types (Single, Double, Quad, etc.) mapped to specific genders.

---

##  The Engine & Algorithm Nuances

The actual algorithm (`lib/allotment-engine.js`) runs entirely in memory. It crunches the numbers fast and only writes to the database at the very end via a batched Prisma `$transaction` (so if something fails on room 499 of 500, it rolls back cleanly instead of breaking the database).

It handles some very specific, deeply nested logic:

**1. The Sorting Logic (Groups & Tiebreakers)**
When students apply together as a pair or a triple, their academic weight is the **Average CGPA** of the group (Descending). 
If there's a tie (e.g. two groups both average an 8.5), it looks strictly at the *Year of Study*. A 2nd-year student gets priority over a 3rd-year (`Year 2 > Year 3 > Year 4`). For mixed groups (e.g., a 2nd year and a 4th year rooming together), we look at the youngest year, so that pair automatically gets the powerful 2nd-year priority.

**2. Group Integrity & Room Packing**
Students can apply alone, in pairs, or in triples via the CSV upload (mapped via a shared `group_id`). 
- **Rule 1 (The Golden Rule):** A group is *never* split into different rooms. If a pair wants a Double room but only one bed is left in that block, the engine skips it. It will never separate them.
- **Rule 2 (Density check):** The engine hates empty space. It explicitly looks for partially filled rooms before placing people in empty ones. If there's an empty bed in an already opening Double room, an unassigned solo student goes there before we open a brand-new Double room.

**3. Modes of Operation (Round 1)**
When triggering Round 1, the admin can choose how aggressive the algorithm should be:
- **Classic (Strict Preferences):** Checks Pref 1, then Pref 2. If both are full, the group goes straight to the waitlist.
- **Smart Vacancy Fill:** If preferences are full, instead of waitlisting, the engine desperately searches the whole campus for an open slot that fits the group's gender and size. Crucially, it doesn't do this randomly. It tries the most historically popular/premium blocks first (using a hardcoded priority list like Block 14, 15, 22) before stuffing people into less desirable blocks. 

---

##  Verification & Round 2

We don't just run the algorithm blind. The session state moves cleanly: `DRAFT` → `ROUND1_DONE` → `ROUND1_LOCKED` → `ROUND2_DONE`.

**The Manual Override (Disallowing)**
After Round 1 finishes, admins get a searchable, filterable dashboard of everybody who got a room. If an admin spots an issue, they can hit `Disallow` on a group.
- **What it does:** It kicks that specific group out of the process permanently and frees their beds. 
- **The nuance:** Because occupancy is dynamic, if you kick out a duo from a Quad room, the other two random students who were assigned the remaining two beds are totally unaffected. The two newly freed beds just become available when you run Round 2.

**Round 2**
Once the admin locks Round 1, Round 2 runs. Waitlisted students retry their preferences (in case beds opened up from admin disallowals) and then go through the Smart Vacancy fill to grab whatever is left.

---

##  CSV Handling
Everything starts with importing data. The client uses `PapaParse` to chew through the uploaded CSVs. It runs strict validation before anything hits the database—ensuring CGPAs are numbers, years are valid, and groups aren't doing impossible things (like three people applying for a single room). It also generates custom CSV reports (Master List, Round 1 results, Block-specific reports) at the end.

---

##  A Note on Development
To be completely honest, a lot of this project was "vibe coded". I knew exactly how I wanted the MIT allotment logic to work, but I had gaps in my knowledge when it came to wiring up the modern Next.js App Router, Prisma, and complex React state. 

Instead of getting bogged down in tutorials, I used AI prompt-engineering to collaboratively write the code, bridge the things I didn't know, and get the actual business logic functional. It was a fast, practical way to build out the system while learning the stack as I went.
