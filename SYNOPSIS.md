# MIT Hostel Allotment System

## Synopsis

The **MIT Hostel Allotment System** is a web-based application designed to automate and streamline the hostel room allotment process at **Manipal Institute of Technology** (MIT), a BTech college with students from Year 1 to Year 4. The system replaces manual, paper-based allotment procedures with a transparent, CGPA-based digital allocation engine — ensuring fairness, speed, and administrative ease.

---

## Need for the Project

Hostel room allotment at MIT involves **23 residential blocks**, **7 different room types** (ranging from Single Non-AC to Quadruple AC), and thousands of students each academic year. The current manual process suffers from:

- **Inefficiency** — Manual sorting, preference matching, and room assignment is time-consuming and error-prone.
- **Lack of transparency** — Students have limited visibility into how rooms are allocated.
- **Complex group handling** — Students can apply solo or with chosen roommates (up to 3 per group), and their averaged CGPA determines priority. Tracking this manually is cumbersome.
- **No historical records** — Previous allotments are not systematically stored for reference or audit.

This system addresses all of the above by providing an admin-operated platform that ingests student preference data via CSV, runs a deterministic allotment algorithm, and displays comprehensive results with visual statistics.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Landing Portal** | Dual-portal homepage for Admin and Student (student portal is under development) |
| **Admin Dashboard** | Overview of blocks, rooms, bed capacity, and recent allotment sessions |
| **Block Management** | Interactive cards for all 11 in-scope blocks with expandable room-type breakdowns, gender filters |
| **CSV Upload & Validation** | Drag-and-drop CSV import with 10+ real-time validation rules (gender-block mismatch, group size vs room capacity, duplicate detection, etc.) |
| **CGPA-Based Allotment Engine** | Two-round algorithm: Round 1 (preference-based) → Waitlist → Round 2 (vacancy-based) → Off-Campus |
| **Group Support** | Students can apply solo, as pairs, or as triples; CGPA is averaged for groups |
| **Partial Room Filling** | Solo applicants in double rooms are paired with other solos; pairs in quad rooms get matched automatically |
| **Results & Analytics** | Per-block occupancy charts, room-type distribution pie charts, gender/year breakdowns, searchable allotment tables |
| **CSV Export** | Download allotment results as CSV for offline use |
| **Session History** | All past allotment sessions are saved and viewable with full statistics |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (React, App Router) | Server-side rendering, client-side interactivity, API routes |
| **Styling** | Vanilla CSS | Custom dark-themed design system with animations |
| **Database** | PostgreSQL (hosted on **Neon**) | Serverless cloud database for persistent storage |
| **ORM** | Prisma | Type-safe database queries and schema management |
| **CSV Parsing** | PapaParse | Client-side CSV parsing and preview |
| **Charts** | Recharts | Bar charts, pie charts for allotment statistics |
| **Runtime** | Node.js | Server-side JavaScript execution |

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER (Client)                  │
│   Landing Page → Admin Panel (Dashboard, Blocks,    │
│   Upload, Allotment, Results, History)              │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / REST API
┌──────────────────────▼──────────────────────────────┐
│               NEXT.JS SERVER (API Routes)           │
│   /api/validate  — CSV validation                   │
│   /api/upload    — Import students & groups         │
│   /api/allotment — Run CGPA-based allocation        │
│   /api/results   — Fetch stats & allotment data     │
│   /api/sessions  — Session CRUD                     │
│   /api/blocks    — Block configurations             │
└──────────────────────┬──────────────────────────────┘
                       │ Prisma ORM
┌──────────────────────▼──────────────────────────────┐
│           POSTGRESQL DATABASE (Neon Cloud)           │
│   blocks · rooms · room_types · students            │
│   student_groups · group_members · allotments       │
│   allotment_sessions                                │
└─────────────────────────────────────────────────────┘
```

---

## Allotment Algorithm

1. **Input**: CSV file containing student data, preferences, and roommate selections
2. **Group Formation**: Students are grouped (solo / pair / triple) using union-find; group CGPA is averaged
3. **Sorting**: Groups sorted by average CGPA in descending order
4. **Round 1** — For each group (highest CGPA first):
   - Try Preference 1 (Block + Room Type) → Try Preference 2 → Try any random vacancy
   - Unplaced groups are **waitlisted**
5. **Round 2** — Same algorithm on waitlisted groups with remaining inventory
   - Unplaced groups are marked **off-campus**
6. **Output**: Room assignments, per-block stats, exportable results

---

## Block & Room Configuration

The system manages **11 in-scope blocks** (Year 2–4 students) out of 23 total:

- **Boys Blocks**: 10, 14, 15, 18, 19, 20, 23
- **Girls Blocks**: 8, 13, 21, 22
- **Room Types**: SA, SAC, SC, DA, DAC, DC, QAC (Single/Double/Quadruple × AC/Non-AC × Attached/Non-Attached)
- **Per Block**: 8 floors × 30 rooms = **240 rooms per block**
- **Total**: **2,640 rooms** with **3,888 bed capacity**

---

## Future Scope

- **Student Portal** — Self-registration, preference submission, and allotment status tracking
- **Authentication** — Secure login with college SSO or email/OTP
- **Room Swap Requests** — Post-allotment room exchange between students
- **Admin Overrides** — Manual room reassignments
- **Email Notifications** — Automated allotment confirmations
- **Mobile Responsiveness** — Full mobile-friendly UI
- **Payment Integration** — Hostel fee collection via UPI/payment gateway
