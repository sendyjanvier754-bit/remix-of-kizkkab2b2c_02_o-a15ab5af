// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type BackfillEntityType =
  | "product"
  | "category"
  | "banner"
  | "country"
  | "department"
  | "commune";

interface BackfillRequest {
  entity_type?: BackfillEntityType | "all";
  limit?: number;
  offset?: number;
  source_language?: string;
  target_languages?: string[];
  dry_run?: boolean;
}

interface SourceEntity {
  entityType: BackfillEntityType;
  table: string;
  fields: string[];
  select: string;
}

const DEFAULT_TARGET_LANGUAGES = ["en", "fr", "ht"];

const SOURCE_ENTITIES: SourceEntity[] = [
  {
    entityType: "product",
    table: "products",
    fields: ["nombre", "descripcion_corta", "descripcion_larga"],
    select: "id,nombre,descripcion_corta,descripcion_larga",
  },
  {
    entityType: "category",
    table: "categories",
    fields: ["name", "description"],
    select: "id,name,description",
  },
  {
    entityType: "banner",
    table: "admin_banners",
    fields: ["title"],
    select: "id,title",
  },
  {
    entityType: "country",
    table: "destination_countries",
    fields: ["name"],
    select: "id,name",
  },
  {
    entityType: "department",
    table: "departments",
    fields: ["name"],
    select: "id,name",
  },
  {
    entityType: "commune",
    table: "communes",
    fields: ["name"],
    select: "id,name",
  },
];

/**
 * Translate text using MyMemory Translation API (free, no key needed)
 */
async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!text || text.trim() === "") return text;
  if (sourceLang === targetLang) return text;

  const langMap: Record<string, string> = {
    es: "es",
    en: "en",
    fr: "fr",
    ht: "ht",
  };

  const from = langMap[sourceLang] || "es";
  const to = langMap[targetLang] || "en";

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.substring(0, 500)
    )}&langpair=${from}|${to}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error("Translation API error:", response.status);
      return text;
    }

    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      if (translated.toUpperCase() === text.toUpperCase() && sourceLang !== targetLang) {
        return text;
      }
      return translated;
    }

    return text;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
}

async function hashText(text: string): Promise<string> {
  const normalized = text.trim();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as BackfillRequest;
    const entityType = body.entity_type ?? "all";
    const limit = Math.max(1, Math.min(body.limit ?? 100, 500));
    const offset = Math.max(0, body.offset ?? 0);
    const sourceLanguage = body.source_language ?? "es";
    const targetLanguages = (body.target_languages?.length
      ? body.target_languages
      : DEFAULT_TARGET_LANGUAGES
    ).filter((lang) => lang !== sourceLanguage);
    const dryRun = body.dry_run ?? false;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const entities =
      entityType === "all"
        ? SOURCE_ENTITIES
        : SOURCE_ENTITIES.filter((entity) => entity.entityType === entityType);

    const summary: Array<Record<string, unknown>> = [];

    for (const entity of entities) {
      const { data: rows, error } = await supabase
        .from(entity.table)
        .select(entity.select)
        .range(offset, offset + limit - 1)
        .order("id", { ascending: true });

      if (error) {
        summary.push({
          entity_type: entity.entityType,
          error: error.message,
          total_rows: 0,
          translated_rows: 0,
          inserted_or_updated: 0,
        });
        continue;
      }

      const typedRows = (rows || []) as Array<Record<string, string | null>>;
      const rowIds = typedRows.map((row) => row.id).filter(Boolean) as string[];

      const existingMap = new Map<string, string>();
      if (rowIds.length > 0 && targetLanguages.length > 0) {
        const { data: existingRows } = await supabase
          .from("content_translations")
          .select("entity_id, field_name, language, source_text_hash")
          .eq("entity_type", entity.entityType)
          .in("entity_id", rowIds)
          .in("language", targetLanguages);

        for (const existing of existingRows || []) {
          existingMap.set(
            `${existing.entity_id}:${existing.field_name}:${existing.language}`,
            existing.source_text_hash || ""
          );
        }
      }

      let translatedRows = 0;
      const upserts: Array<Record<string, unknown>> = [];

      for (const row of typedRows) {
        if (!row.id) continue;

        let rowHadTranslation = false;

        for (const fieldName of entity.fields) {
          const originalText = row[fieldName];
          if (!originalText || `${originalText}`.trim().length === 0) continue;

          const sourceTextHash = await hashText(`${originalText}`);

          for (const language of targetLanguages) {
            const mapKey = `${row.id}:${fieldName}:${language}`;
            const existingHash = existingMap.get(mapKey);
            if (existingHash && existingHash === sourceTextHash) continue;

            const translatedText = await translateText(
              `${originalText}`,
              sourceLanguage,
              language
            );

            upserts.push({
              entity_type: entity.entityType,
              entity_id: row.id,
              field_name: fieldName,
              language,
              source_text: `${originalText}`,
              source_text_hash: sourceTextHash,
              translated_text: translatedText,
              is_auto_translated: true,
              updated_at: new Date().toISOString(),
            });

            rowHadTranslation = true;
          }
        }

        if (rowHadTranslation) {
          translatedRows += 1;
        }
      }

      if (!dryRun && upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("content_translations")
          .upsert(upserts, {
            onConflict: "entity_type,entity_id,field_name,language",
          });

        if (upsertError) {
          summary.push({
            entity_type: entity.entityType,
            error: upsertError.message,
            total_rows: typedRows.length,
            translated_rows: translatedRows,
            inserted_or_updated: 0,
          });
          continue;
        }
      }

      summary.push({
        entity_type: entity.entityType,
        total_rows: typedRows.length,
        translated_rows: translatedRows,
        inserted_or_updated: upserts.length,
        dry_run: dryRun,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        entity_type: entityType,
        source_language: sourceLanguage,
        target_languages: targetLanguages,
        limit,
        offset,
        dry_run: dryRun,
        summary,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("backfill-translations error:", message);

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
