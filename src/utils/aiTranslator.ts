
import { Translations } from "../types";

export const generateTranslations = async (sourceData: Record<string, string>): Promise<Translations> => {
  try {
    // Construct the API URL to match the logic used in StoreContext (forcing port 3000 if not configured otherwise)
    // @ts-ignore
    const env = import.meta.env;
    let baseUrl = env.VITE_API_URL;

    if (!baseUrl) {
       // Default to current hostname on port 3000 as per infrastructure
       baseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    }

    // Remove trailing slash if present
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
    return data.translations || {};
  } catch (error) {
    console.error("AI Translation failed:", error);
    return {};
  }
};
