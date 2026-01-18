
import express from 'express';

const router = express.Router();

router.post('/translate', async (req, res) => {
    const { sourceData } = req.body;
    if (!sourceData) return res.status(400).json({ error: 'Missing sourceData' });
    if (!process.env.API_KEY) return res.json({ translations: { en: {}, de: {} } });

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Translate to EN/DE JSON: ${JSON.stringify(sourceData)}`;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanText));
    } catch (e) {
        console.error("Translation Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/optimize-route', async (req, res) => {
    const { depot, orders, departureTime, settings } = req.body;

    if (!process.env.API_KEY) {
        return res.status(503).json({ error: 'AI API Key not configured on server.' });
    }

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
        You are a logistics route optimizer for a delivery service in the Czech Republic.
        
        INPUT DATA:
        - Depot: "${depot}"
        - Departure Time: ${departureTime}
        - Loading Time per Item: ${settings.loadingSecondsPerItem} seconds
        - Stop Base Time: ${settings.stopTimeMinutes} minutes
        - Unloading (Paid): ${settings.unloadingPaidSeconds} seconds
        - Unloading (Unpaid/Cash): ${settings.unloadingUnpaidSeconds} seconds
        
        ORDERS TO DELIVER:
        ${JSON.stringify(orders)}

        TASK:
        1. Validate Addresses: Check if the address string looks like a valid specific address (must have Street + Number, or Village + Number). If it's vague (e.g. just "Prague"), missing a number, or nonsense, mark 'error' with a Czech reason.
        2. Optimize Route: Sort the VALID orders to minimize total travel time starting from Depot. Put INVALID addresses at the very end of the list.
        3. Calculate Times: 
           - Start at Departure Time + (Total Items * Loading Time per Item).
           - Estimate travel time between stops (assume avg speed 30km/h in city).
           - Add Service Time at each stop (Base Time + Unloading Time based on 'isPaid').
        
        OUTPUT FORMAT (JSON Array of objects):
        [
            {
                "orderId": "string",
                "type": "delivery",
                "address": "string",
                "arrivalTime": "HH:MM",
                "departureTime": "HH:MM",
                "distanceKm": number (estimate),
                "error": "string or null"
            }
        ]
        
        Return ONLY valid JSON.
        `;

        const response = await ai.models.generateContent({ 
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const cleanText = response.text.trim();
        const routeSteps = JSON.parse(cleanText);

        res.json({ success: true, steps: routeSteps });

    } catch (e) {
        console.error("Route Optimization Error:", e);
        res.status(500).json({ error: 'Failed to optimize route via AI.' });
    }
});

export default router;
