async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/sessions/2/settings', { 
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blockCutoffsEnabled: false,
                maxCgpaDiffEnabled: true,
                maxCgpaDiff: 1.5,
                cutoffs: []
            })
        });
        const text = await res.text();
        console.log("STATUS:", res.status);
        console.log("TEXT:", text);
    } catch (err) {
        console.error("ERROR:", err);
    }
}
run();
