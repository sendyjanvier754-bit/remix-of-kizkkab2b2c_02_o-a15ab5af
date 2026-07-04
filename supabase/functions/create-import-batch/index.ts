import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InputProduct {
  row_index: number;
  source_product_id_1688?: string;
  sku?: string;
  image_url?: string;
  source_title_zh?: string;
  source_description_zh?: string;
  raw_payload?: Record<string, unknown>;
}

interface Body {
  name?: string;
  source_filename?: string;
  market_id?: string;
  languages: string[]; // e.g. ["es","en","fr","ht"]
  products: InputProduct[];
}

const LANG_NAME: Record<string, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  ht: "Haitian Creole",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
};

async function translateBatch(
  apiKey: string,
  items: { index: number; title: string; description: string }[],
  langs: string[],
) {
  const langList = langs.map((l) => `${l} (${LANG_NAME[l] ?? l})`).join(", ");
  const itemsList = items
    .map(
      (it) =>
        `${it.index}. TITLE: "${(it.title || "").slice(0, 500)}" | DESCRIPTION: "${(it.description || "").slice(0, 1200)}"`,
    )
    .join("\n");

  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content: `You are a product translator for a B2B/B2C marketplace. Translate Chinese (or any) product titles and descriptions into the requested target languages: ${langList}.
Rules:
- Title: faithful commercial translation, concise, no invented marketing.
- Description: commercial description in the target language. Do NOT use commas (,); use periods, semicolons or line breaks. If source description is missing, produce a short commercial description from the title.
- Return one entry per source item and per target language.`,
      },
      {
        role: "user",
        content: `Translate the following ${items.length} products into these languages: ${langs.join(", ")}.\n${itemsList}`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_translations",
          description: "Return translated titles and descriptions per language",
          parameters: {
            type: "object",
            properties: {
              translations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    language: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["index", "language", "title", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["translations"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "return_translations" },
    },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("AI gateway error", resp.status, errText);
    throw new Error(`ai_gateway_${resp.status}`);
  }
  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) return [];
  const parsed = JSON.parse(toolCall.function.arguments);
  return (parsed.translations ?? []) as {
    index: number;
    language: string;
    title: string;
    description: string;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    // Verify admin role via SECURITY DEFINER function
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Body;
    if (!payload?.products?.length || !payload?.languages?.length) {
      return new Response(JSON.stringify({ error: "products and languages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for bulk inserts (admin verified above)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Create batch
    const { data: batch, error: batchErr } = await admin
      .from("import_batches")
      .insert({
        name: payload.name ?? payload.source_filename ?? "Lote 1688",
        source_filename: payload.source_filename,
        market_id: payload.market_id ?? null,
        languages: payload.languages,
        status: "in_review",
        total_products: payload.products.length,
        created_by: userId,
      })
      .select()
      .single();
    if (batchErr) throw batchErr;

    // 2) Insert products
    const productRows = payload.products.map((p) => ({
      batch_id: batch.id,
      row_index: p.row_index,
      source_product_id_1688: p.source_product_id_1688 ?? null,
      sku: p.sku ?? null,
      image_url: p.image_url ?? null,
      source_title_zh: p.source_title_zh ?? null,
      source_description_zh: p.source_description_zh ?? null,
      raw_payload: p.raw_payload ?? {},
    }));
    const { data: inserted, error: prodErr } = await admin
      .from("import_batch_products")
      .insert(productRows)
      .select("id,row_index,source_title_zh,source_description_zh");
    if (prodErr) throw prodErr;

    // 3) Translate in chunks of 8
    const CHUNK = 8;
    const idByIndex = new Map<number, string>();
    const titleByIndex = new Map<number, string>();
    const descByIndex = new Map<number, string>();
    for (const p of inserted) {
      idByIndex.set(p.row_index, p.id);
      titleByIndex.set(p.row_index, p.source_title_zh ?? "");
      descByIndex.set(p.row_index, p.source_description_zh ?? "");
    }

    const translationRows: any[] = [];
    const sortedIndexes = [...idByIndex.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sortedIndexes.length; i += CHUNK) {
      const slice = sortedIndexes.slice(i, i + CHUNK);
      const items = slice.map((idx) => ({
        index: idx,
        title: titleByIndex.get(idx) ?? "",
        description: descByIndex.get(idx) ?? "",
      }));
      let translations: {
        index: number;
        language: string;
        title: string;
        description: string;
      }[] = [];
      try {
        translations = await translateBatch(LOVABLE_API_KEY, items, payload.languages);
      } catch (e) {
        console.error("translateBatch failed for slice", i, e);
      }

      // Fill missing (index+lang combos) with empty ai_text
      const seen = new Set<string>();
      for (const t of translations) {
        const key = `${t.index}|${t.language}`;
        seen.add(key);
        const pid = idByIndex.get(t.index);
        if (!pid) continue;
        translationRows.push({
          batch_product_id: pid,
          language_code: t.language,
          field: "title",
          ai_text: t.title ?? "",
          status: "pending_approval",
        });
        translationRows.push({
          batch_product_id: pid,
          language_code: t.language,
          field: "description",
          ai_text: t.description ?? "",
          status: "pending_approval",
        });
      }
      // Ensure every (product, lang) exists (even without AI response)
      for (const idx of slice) {
        for (const lang of payload.languages) {
          if (seen.has(`${idx}|${lang}`)) continue;
          const pid = idByIndex.get(idx);
          if (!pid) continue;
          translationRows.push({
            batch_product_id: pid,
            language_code: lang,
            field: "title",
            ai_text: "",
            status: "pending_approval",
          });
          translationRows.push({
            batch_product_id: pid,
            language_code: lang,
            field: "description",
            ai_text: "",
            status: "pending_approval",
          });
        }
      }
    }

    if (translationRows.length) {
      // Chunk inserts to avoid payload limits
      const BATCH = 500;
      for (let i = 0; i < translationRows.length; i += BATCH) {
        const { error: tErr } = await admin
          .from("import_batch_translations")
          .insert(translationRows.slice(i, i + BATCH));
        if (tErr) throw tErr;
      }
    }

    return new Response(
      JSON.stringify({ batch_id: batch.id, products: inserted.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-import-batch error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
