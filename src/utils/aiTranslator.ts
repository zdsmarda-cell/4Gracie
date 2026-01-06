
import { Translations } from "../types";

export const generateTranslations = async (sourceData: Record<string, string>): Promise<Translations> => {
  try {
    // Safely access env to prevent crash if import.meta is not fully supported in current context
    // @ts-ignore
    const env = (import.meta && import.meta.env) ? import.meta.env : {};
    let baseUrl = env?.VITE_API_URL;

    if (!baseUrl) {
       // Default fallback
       baseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    const response = await fetch(`${baseUrl}/api/admin/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceData })
    });

    if (!response.ok) {
        throw new Error('Translation request failed');
    }

    const data = await response.json();
    
    // FIX: The API often returns the translations object directly (keys 'en', 'de')
    // instead of wrapping it in a 'translations' property. We check for both.
    if (data.en || data.de) {
        return data;
    }
    
    return data.translations || {};
  } catch (error) {
    console.error("AI Translation failed:", error);
    return {};
  }
};
