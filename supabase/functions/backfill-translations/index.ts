// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  { entityType: "product", table: "products", fields: ["nombre", "descripcion_corta", "descripcion_larga"], select: "id,nombre,descripcion_corta,descripcion_larga" },
  { entityType: "category", table: "categories", fields: ["name", "description"], select: "id,name,description" },
  { entityType: "banner", table: "admin_banners", fields: ["title"], select: "id,title" },
  { entityType: "country", table: "destination_countries", fields: ["name"], select: "id,name" },
  { entityType: "department", table: "departments", fields: ["name"], select: "id,name" },
  { entityType: "commune", table: "communes", fields: ["name"], select: "id,name" },
];

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
        summary.push({ entity_type: entity.entityType, error: error.message, total_rows: 0, translated_rows: 0 });
        continue;
      }

      const typedRows = (rows || []) as Array<Record<string, string | null>>;
      let translatedRows = 0;
      let totalCalls = 0;

      // Delegate translation to translate-content edge function (uses Lovable AI Gateway)
      // Process per row × per language so each call has shared field context.
      if (!dryRun) {
        for (const row of typedRows) {
          if (!row.id) continue;
          const fields: Record<string, string> = {};
          for (const fieldName of entity.fields) {
            const v = row[fieldName];
            if (v && `${v}`.trim().length > 0) fields[fieldName] = `${v}`;
          }
          if (Object.keys(fields).length === 0) continue;

          let rowHadTranslation = false;
          for (const language of targetLanguages) {
            try {
              const { error: invokeErr } = await supabase.functions.invoke("translate-content", {
                body: {
                  entity_type: entity.entityType,
                  entity_id: row.id,
                  fields,
                  source_language: sourceLanguage,
                  target_language: language,
                },
              });
              if (invokeErr) {
                console.warn(`translate-content failed for ${entity.entityType}:${row.id}:${language}`, invokeErr);
              } else {
                rowHadTranslation = true;
                totalCalls += 1;
              }
            } catch (err) {
              console.warn(`translate-content threw for ${entity.entityType}:${row.id}:${language}`, err);
            }
          }
          if (rowHadTranslation) translatedRows += 1;
        }
      }

      summary.push({
        entity_type: entity.entityType,
        total_rows: typedRows.length,
        translated_rows: translatedRows,
        ai_calls: totalCalls,
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
