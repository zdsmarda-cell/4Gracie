
import { Translations } from "../types";

export const generateTranslations = async (sourceData: Record<string, string>): Promise<Translations> => {
  try {
    const response = await fetch('/api/admin/translate', {
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
