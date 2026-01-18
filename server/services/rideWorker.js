
import { getDb, parseJsonCol } from '../db.js';
import { optimizeRouteData } from './aiOptimizer.js';

export const startRideWorker = () => {
    console.log("⚙️ Starting Ride Worker (Interval: 60s)...");
    
    const runWorker = async () => {
        const db = await getDb();
        if (!db) return;

        try {
            // 1. Auto-start rides logic (Planned -> Active if time passed)
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM

            const [ridesToStart] = await db.query(
                "SELECT id FROM rides WHERE status = 'planned' AND date = ? AND departure_time <= ?",
                [currentDate, currentTime]
            );

            if (ridesToStart.length > 0) {
                const ids = ridesToStart.map(r => r.id);
                await db.query("UPDATE rides SET status = 'active' WHERE id IN (?)", [ids]);
                console.log(`🚕 Ride Worker: Auto-started ${ridesToStart.length} rides.`);
            }

            // 2. Auto-Generate Routes for Planned Rides
            // Look for rides that are 'planned' but have NO steps calculated yet
            const [pendingRides] = await db.query(
                "SELECT * FROM rides WHERE status = 'planned' AND (steps IS NULL OR JSON_LENGTH(steps) = 0)"
            );

            if (pendingRides.length > 0) {
                console.log(`🚕 Ride Worker: Found ${pendingRides.length} rides pending route calculation.`);
                
                // Get Global Settings for logistics config
                const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
                const globalSettings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
                
                const logisticsSettings = globalSettings.logistics || {
                    stopTimeMinutes: 5,
                    loadingSecondsPerItem: 30,
                    unloadingPaidSeconds: 120,
                    unloadingUnpaidSeconds: 300
                };
                
                const depotAddress = globalSettings.companyDetails ? 
                    `${globalSettings.companyDetails.street}, ${globalSettings.companyDetails.city}` : 
                    "Depot Address Missing";

                for (const ride of pendingRides) {
                    try {
                        const orderIds = parseJsonCol(ride, 'order_ids');
                        if (!orderIds || orderIds.length === 0) continue;

                        // Fetch Order Details
                        const [orderRows] = await db.query(
                            "SELECT id, full_json FROM orders WHERE id IN (?)", 
                            [orderIds]
                        );
                        
                        const ordersPayload = orderRows.map(row => {
                            const o = parseJsonCol(row, 'full_json');
                            return {
                                id: o.id,
                                address: o.deliveryAddress || `${o.deliveryStreet}, ${o.deliveryCity}`,
                                isPaid: o.isPaid,
                                itemsCount: o.items ? o.items.reduce((s, i) => s + i.quantity, 0) : 0,
                                customerName: o.deliveryName || o.userName,
                                customerPhone: o.deliveryPhone,
                                note: o.note
                            };
                        });

                        console.log(`🚕 Ride Worker: Calculating route for Ride ${ride.id} with ${ordersPayload.length} orders...`);
                        
                        // Call AI Service
                        const optimizedSteps = await optimizeRouteData(
                            depotAddress,
                            ordersPayload,
                            ride.departure_time,
                            logisticsSettings
                        );

                        // Save Result
                        await db.query(
                            "UPDATE rides SET steps = ? WHERE id = ?",
                            [JSON.stringify(optimizedSteps), ride.id]
                        );
                        
                        console.log(`✅ Ride Worker: Ride ${ride.id} optimized successfully.`);

                    } catch (err) {
                        console.error(`❌ Ride Worker: Failed to optimize Ride ${ride.id}:`, err.message);
                    }
                }
            }

        } catch (e) {
            console.error("❌ Ride Worker Error:", e.message);
        }
    };

    // Run immediately then interval
    // setTimeout(runWorker, 5000); // Initial delay
    setInterval(runWorker, 60000); 
};
