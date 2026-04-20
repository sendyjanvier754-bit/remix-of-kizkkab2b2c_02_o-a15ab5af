// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface TranslateRequest {
  entity_type: string;
  entity_id: string;
  fields: Record<string, string>;
  source_language?: string;
  target_language: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  ht: "Haitian Creole (Kreyòl Ayisyen)",
};

async function hashText(text: string): Promise<string> {
  const normalized = text.trim();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Translate a set of fields for a single entity using Lovable AI Gateway.
 * Returns a map { field_name: translated_text }. Falls back to original text on failure.
 */
async function translateFieldsWithAI(
  entityType: string,
  fields: Record<string, string>,
  sourceLang: string,
  targetLang: string
): Promise<Record<string, string>> {
  if (sourceLang === targetLang) return { ...fields };
  const fieldEntries = Object.entries(fields).filter(([, v]) => v && v.trim().length > 0);
  if (fieldEntries.length === 0) return {};

  const sourceName = LANGUAGE_NAMES[sourceLang] || sourceLang;
  const targetName = LANGUAGE_NAMES[targetLang] || targetLang;

  const systemPrompt = `You are a professional e-commerce translator. Translate short labels (category names, product titles, banner headlines, descriptions) from ${sourceName} to ${targetName}.

Rules:
- Return ONLY the translation, no quotes, no explanations, no transliteration of the source.
- Preserve brand names, units (kg, ml), proper nouns, and SKU codes unchanged.
- Use natural, native-sounding ${targetName}. For Haitian Creole use real Kreyòl Ayisyen words (e.g., "Gason" for Hombre/Man, NOT "Male"). Never return English when the target is French or Creole.
- Keep capitalization style of the source.
- For very short ambiguous words, use the most common e-commerce/clothing/retail meaning (e.g., "Tops" stays "Tops" in English/French/Creole, "Relojes" -> "Watches" in English).
- Decode HTML entities (& not &amp;).`;

  const userPrompt = `Entity type: ${entityType}
Translate each field below into ${targetName}. Return one translation per field via the tool.

${fieldEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`;

  const properties: Record<string, unknown> = {};
  for (const [k] of fieldEntries) {
    properties[k] = { type: "string", description: `Translation of "${k}" into ${targetName}` };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_translations",
              description: "Return the translated text for each field.",
              parameters: {
                type: "object",
                properties,
                required: fieldEntries.map(([k]) => k),
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_translations" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI gateway ${response.status}:`, errText.substring(0, 300));
      // 429 / 402 → fall back gracefully (return originals; client/UI keeps source text)
      const fallback: Record<string, string> = {};
      for (const [k, v] of fieldEntries) fallback[k] = v;
      return fallback;
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.warn("AI returned no tool call, falling back to source");
      const fallback: Record<string, string> = {};
      for (const [k, v] of fieldEntries) fallback[k] = v;
      return fallback;
    }

    const parsed = JSON.parse(argsStr) as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [k, v] of fieldEntries) {
      const translated = parsed[k];
      result[k] = translated && translated.trim().length > 0
        ? decodeHtmlEntities(translated.trim())
        : v;
    }
    return result;
  } catch (err) {
    console.error("translateFieldsWithAI error:", err);
    const fallback: Record<string, string> = {};
    for (const [k, v] of fieldEntries) fallback[k] = v;
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

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

      // Check existing cache
      const { data: existing } = await supabase
        .from("content_translations")
        .select("field_name, translated_text, source_text_hash")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .eq("language", target_language);

      const existingMap = new Map<string, { text: string; hash: string | null }>(
        (existing || []).map((e: any) => [
          e.field_name,
          { text: e.translated_text, hash: e.source_text_hash },
        ])
      );

      const translatedFields: Record<string, string> = {};
      const fieldsToTranslate: Record<string, string> = {};
      const hashes: Record<string, string> = {};

      for (const [fieldName, originalText] of Object.entries(fields)) {
        if (!originalText) {
          translatedFields[fieldName] = "";
          continue;
        }
        const sourceHash = await hashText(originalText);
        hashes[fieldName] = sourceHash;
        const cached = existingMap.get(fieldName);
        if (cached?.hash === sourceHash) {
          translatedFields[fieldName] = cached.text;
        } else {
          fieldsToTranslate[fieldName] = originalText;
        }
      }

      // Translate missing fields in a SINGLE AI call (better context, cheaper)
      if (Object.keys(fieldsToTranslate).length > 0) {
        const translated = await translateFieldsWithAI(
          entity_type,
          fieldsToTranslate,
          source_language,
          target_language
        );

        const toUpsert: any[] = [];
        for (const [fieldName, originalText] of Object.entries(fieldsToTranslate)) {
          const translatedText = translated[fieldName] || originalText;
          translatedFields[fieldName] = translatedText;
          toUpsert.push({
            entity_type,
            entity_id,
            field_name: fieldName,
            language: target_language,
            source_text: originalText,
            source_text_hash: hashes[fieldName],
            translated_text: translatedText,
            is_auto_translated: true,
            updated_at: new Date().toISOString(),
          });
        }

        if (toUpsert.length > 0) {
          const { error: upsertErr } = await supabase
            .from("content_translations")
            .upsert(toUpsert, {
              onConflict: "entity_type,entity_id,field_name,language",
            });
          if (upsertErr) console.error("upsert error:", upsertErr);
        }
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
