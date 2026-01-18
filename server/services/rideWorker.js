
import { getDb } from '../db.js';

export const startRideWorker = () => {
    console.log("⚙️ Starting Ride Worker (Interval: 60s)...");
    
    const runWorker = async () => {
        const db = await getDb();
        if (!db) return;

        // console.log("🚕 Ride Worker: Checking statuses...");

        try {
            // 1. Auto-start rides logic (Planned -> Active if time passed)
            // Checks if today's rides with 'planned' status have passed their departure time
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM

            const [rides] = await db.query(
                "SELECT id FROM rides WHERE status = 'planned' AND date = ? AND departure_time <= ?",
                [currentDate, currentTime]
            );

            if (rides.length > 0) {
                const ids = rides.map(r => r.id);
                await db.query("UPDATE rides SET status = 'active' WHERE id IN (?)", [ids]);
                console.log(`🚕 Ride Worker: Auto-started ${rides.length} rides (Time passed).`);
            }

            // 2. Logic for Auto-Generating rides from unassigned orders could go here.
            // Currently kept empty to avoid unexpected AI API costs loops.
            // You can implement "Select unassigned orders -> Call AI -> Insert Ride" here.

        } catch (e) {
            console.error("❌ Ride Worker Error:", e.message);
        }
    };

    // Run immediately then interval
    runWorker();
    setInterval(runWorker, 60000); 
};
