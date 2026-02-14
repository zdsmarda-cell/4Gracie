
import { getDb, parseJsonCol } from '../db.js';
import { optimizeRouteData } from './aiOptimizer.js';

export const startRideWorker = () => {
    console.log("⚙️ Starting Ride Worker (Interval: 60s)...");
    
    const runWorker = async () => {
        const db = await getDb();
        if (!db) return;

        try {
            // REMOVED: Auto-start logic.
            // Rides must be started manually by the Driver in the UI.
            
            // 2. Auto-Generate Routes for Planned Rides with missing steps
            // Only look for 'planned' rides. 'active' rides implies the driver already started it, 
            // so we shouldn't overwrite the route unless explicitly requested via API (recalc).
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
                            
                            // Prioritize structured fields (Street + City) because Admin Edit updates these.
                            // Fallback to o.deliveryAddress (blob string) only if structured data is missing.
                            let addressToUse = o.deliveryAddress;
                            if (o.deliveryStreet && o.deliveryCity) {
                                addressToUse = `${o.deliveryStreet}, ${o.deliveryCity} ${o.deliveryZip || ''}`;
                            }

                            return {
                                id: o.id,
                                address: addressToUse,
                                isPaid: o.isPaid,
                                itemsCount: o.items ? o.items.reduce((s, i) => s + i.quantity, 0) : 0,
                                customerName: o.deliveryName || o.userName,
                                customerPhone: o.deliveryPhone,
                                note: o.note
                            };
                        });

                        console.log(`🚕 Ride Worker: Calculating route for Ride ${ride.id} with ${ordersPayload.length} orders...`);
                        
                        // Call AI Service
                        // AI returns sorted steps but might drop non-essential fields like note/phone
                        const aiSteps = await optimizeRouteData(
                            depotAddress,
                            ordersPayload,
                            ride.departure_time,
                            logisticsSettings
                        );

                        // MERGE BACK DETAILS: Ensure Note, Phone, Name are preserved in the saved JSON
                        const finalSteps = aiSteps.map(step => {
                            const original = ordersPayload.find(o => o.id === step.orderId);
                            if (original) {
                                return {
                                    ...step,
                                    customerName: original.customerName,
                                    customerPhone: original.customerPhone,
                                    note: original.note,
                                    isPaid: original.isPaid,
                                    itemsCount: original.itemsCount
                                };
                            }
                            return step;
                        });

                        // Save Result
                        await db.query(
                            "UPDATE rides SET steps = ? WHERE id = ?",
                            [JSON.stringify(finalSteps), ride.id]
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
