import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TranslateRequest {
  entity_type: string; // 'category', 'product', 'variant', 'notification'
  entity_id: string;
  fields: Record<string, string>; // { field_name: original_text }
  source_language?: string; // default 'es'
  target_language: string; // 'en', 'fr', 'ht'
}

interface TranslateBatchRequest {
  items: TranslateRequest[];
}

/**
 * Translate text using MyMemory Translation API (free, no key needed)
 * Supports es->en, es->fr, es->ht
 */
async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!text || text.trim() === "") return text;
  if (sourceLang === targetLang) return text;

  // Map our language codes to MyMemory codes
  const langMap: Record<string, string> = {
    es: "es",
    en: "en",
    fr: "fr",
    ht: "ht", // Haitian Creole
  };

  const from = langMap[sourceLang] || "es";
  const to = langMap[targetLang] || "en";

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.substring(0, 500) // API limit
    )}&langpair=${from}|${to}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error("Translation API error:", response.status);
      return text;
    }

    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      // MyMemory sometimes returns the original text uppercased when it can't translate
      if (translated.toUpperCase() === text.toUpperCase() && sourceLang !== targetLang) {
        return text; // Return original if translation seems like a no-op
      }
      return translated;
    }
    return text;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    // Support both single and batch requests
    const items: TranslateRequest[] = body.items || [body];
    const results: Record<string, Record<string, string>> = {};

    for (const item of items) {
      const {
        entity_type,
        entity_id,
        fields,
        source_language = "es",
        target_language,
      } = item;

      if (!entity_type || !entity_id || !target_language || !fields) {
        continue;
      }

      // Check existing translations first
      const { data: existing } = await supabase
        .from("content_translations")
        .select("field_name, translated_text")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .eq("language", target_language);

      const existingMap = new Map(
        (existing || []).map((e: any) => [e.field_name, e.translated_text])
      );

      const translatedFields: Record<string, string> = {};
      const toUpsert: any[] = [];

      for (const [fieldName, originalText] of Object.entries(fields)) {
        if (!originalText) {
          translatedFields[fieldName] = "";
          continue;
        }

        // Use cached translation if available
        if (existingMap.has(fieldName)) {
          translatedFields[fieldName] = existingMap.get(fieldName)!;
          continue;
        }

        // Translate and cache
        const translated = await translateText(
          originalText,
          source_language,
          target_language
        );
        translatedFields[fieldName] = translated;

        toUpsert.push({
          entity_type,
          entity_id,
          field_name: fieldName,
          language: target_language,
          translated_text: translated,
          is_auto_translated: true,
          updated_at: new Date().toISOString(),
        });
      }

      // Batch upsert translations
      if (toUpsert.length > 0) {
        await supabase.from("content_translations").upsert(toUpsert, {
          onConflict: "entity_type,entity_id,field_name,language",
        });
      }

      results[entity_id] = translatedFields;
    }

    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("translate-content error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
