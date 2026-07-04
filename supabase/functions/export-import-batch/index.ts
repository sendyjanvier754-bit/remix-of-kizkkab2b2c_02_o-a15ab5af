import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { batch_id } = await req.json();
    if (!batch_id) {
      return new Response(JSON.stringify({ error: "batch_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: batch, error: bErr } = await admin
      .from("import_batches")
      .select("*")
      .eq("id", batch_id)
      .single();
    if (bErr || !batch) throw bErr ?? new Error("batch not found");

    const { data: products, error: pErr } = await admin
      .from("import_batch_products")
      .select("*")
      .eq("batch_id", batch_id)
      .order("row_index", { ascending: true });
    if (pErr) throw pErr;

    const { data: translations, error: tErr } = await admin
      .from("import_batch_translations")
      .select("*")
      .in("batch_product_id", (products ?? []).map((p: any) => p.id));
    if (tErr) throw tErr;

    const langs: string[] = Array.isArray(batch.languages) ? batch.languages : [];

    // Build a map: product_id -> { lang -> { title, description, isPendingTitle, isPendingDesc } }
    type Cell = { text: string; pending: boolean };
    const perProduct = new Map<string, Record<string, { title: Cell; description: Cell }>>();
    for (const p of products ?? []) {
      const langMap: Record<string, { title: Cell; description: Cell }> = {};
      for (const l of langs) {
        langMap[l] = {
          title: { text: "", pending: true },
          description: { text: "", pending: true },
        };
      }
      perProduct.set(p.id, langMap);
    }
    for (const t of translations ?? []) {
      const bag = perProduct.get(t.batch_product_id);
      if (!bag) continue;
      if (!bag[t.language_code]) continue;
      const approved = t.status === "approved";
      const text = approved ? (t.edited_text ?? t.ai_text ?? "") : (t.edited_text ?? t.ai_text ?? "");
      bag[t.language_code][t.field as "title" | "description"] = {
        text,
        pending: !approved,
      };
    }

    // Build rows for Excel
    const header = [
      "row_index",
      "source_product_id_1688",
      "sku",
      "image_url",
      "source_title_zh",
      "source_description_zh",
    ];
    for (const l of langs) {
      header.push(`title_${l}`, `description_${l}`, `status_${l}`);
    }

    const rows: (string | number)[][] = [header];
    for (const p of products ?? []) {
      const bag = perProduct.get(p.id) ?? {};
      const row: (string | number)[] = [
        p.row_index,
        p.source_product_id_1688 ?? "",
        p.sku ?? "",
        p.image_url ?? "",
        p.source_title_zh ?? "",
        p.source_description_zh ?? "",
      ];
      for (const l of langs) {
        const cell = bag[l];
        const title = cell?.title?.text ?? "";
        const desc = cell?.description?.text ?? "";
        const pending = (cell?.title?.pending || cell?.description?.pending) ?? true;
        row.push(
          (cell?.title?.pending ? "[PENDIENTE] " : "") + title,
          (cell?.description?.pending ? "[PENDIENTE] " : "") + desc,
          pending ? "pending" : "approved",
        );
      }
      rows.push(row);
    }

    // Build a simple XLSX using SheetJS via esm
    const XLSX = await import("https://esm.sh/xlsx@0.18.5");
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
    const base64 = btoa(String.fromCharCode(...new Uint8Array(out)));

    // Mark batch as exported
    await admin
      .from("import_batches")
      .update({
        status: "exported",
        exported_by: userId,
        last_exported_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    return new Response(
      JSON.stringify({
        filename: `${(batch.name ?? "lote-1688").replace(/[^a-z0-9-_]+/gi, "_")}.xlsx`,
        base64,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("export-import-batch error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
