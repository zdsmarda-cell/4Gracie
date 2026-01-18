
import { GoogleGenAI } from '@google/genai';

export const optimizeRouteData = async (depot, orders, departureTime, settings) => {
    if (!process.env.API_KEY) {
        throw new Error('AI API Key not configured on server.');
    }

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
    1. Validate Addresses: Check if the address string looks like a valid specific address.
    2. Optimize Route: Sort the VALID orders to minimize total travel time starting from Depot.
    3. Calculate Times: 
       - Start at Departure Time + (Total Items * Loading Time per Item).
       - Estimate travel time between stops (assume avg speed 30km/h in city).
       - Add Service Time at each stop.
    
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
    return JSON.parse(cleanText);
};
