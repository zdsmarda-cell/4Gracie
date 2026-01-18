
import express from 'express';
import { optimizeRouteData } from '../services/aiOptimizer.js';

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

    try {
        const routeSteps = await optimizeRouteData(depot, orders, departureTime, settings);
        res.json({ success: true, steps: routeSteps });
    } catch (e) {
        console.error("Route Optimization Error:", e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
