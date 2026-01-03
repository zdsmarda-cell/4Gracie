
import { GoogleGenAI, Type } from "@google/genai";
import { Translations } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTranslations = async (sourceData: Record<string, string>): Promise<Translations> => {
  try {
    const prompt = `
      Translate the following JSON object values from Czech (CS) to English (EN) and German (DE).
      Return a JSON object with 'en' and 'de' keys, each containing the translated key-value pairs.
      Keep the tone professional and suitable for a catering e-shop.
      
      Source Data:
      ${JSON.stringify(sourceData)}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            en: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                label: { type: Type.STRING },
                // Allow dynamic keys effectively by not restricting too much, but schema needs structure
                // For simplicity in this prompt context, we assume keys match sourceData
              }
            },
            de: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                label: { type: Type.STRING },
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Translations;
    }
    return {};
  } catch (error) {
    console.error("AI Translation failed:", error);
    return {};
  }
};
