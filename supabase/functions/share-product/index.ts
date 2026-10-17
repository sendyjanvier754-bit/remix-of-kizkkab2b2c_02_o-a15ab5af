// Public share link for products: serves Open Graph tags (variant / product image)
// to social crawlers (WhatsApp, Facebook...) and redirects humans to the product page.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://kizkka.com";
const ok = (u: unknown) => typeof u === "string" && /^https?:\/\//.test(u) ? u : "";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const sku = (url.searchParams.get("sku") || "").slice(0, 120);
  const seller = url.searchParams.get("seller") || "";
  const ref = url.searchParams.get("ref") || "";
  const price = url.searchParams.get("p") || "";

  const params = new URLSearchParams();
  if (/^[0-9a-f-]{36}$/i.test(seller)) params.set("seller", seller);
  if (/^[\w-]{1,40}$/.test(ref)) params.set("ref", ref);
  const qs = params.toString();
  const target = `${SITE}/producto/${encodeURIComponent(sku)}${qs ? `?${qs}` : ""}`;

  let title = "Kizkka";
  let image = "";
  if (sku) {
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: v } = await sb
        .from("product_variants")
        .select("images, product_id")
        .eq("sku", sku)
        .maybeSingle();
      let productId = v?.product_id as string | undefined;
      image = ok(v?.images?.[0]);
      const pq = sb.from("products").select("nombre, imagen_principal, galeria_imagenes");
      const { data: p } = productId
        ? await pq.eq("id", productId).maybeSingle()
        : await pq.eq("sku_interno", sku.split("-")[0]).limit(1).maybeSingle();
      if (p) {
        title = p.nombre || title;
        image = image || ok(p.imagen_principal) || ok(p.galeria_imagenes?.[0]);
      }
    } catch (e) {
      console.error("share-product lookup failed", e);
    }
  }

  const desc = price && /^[\d.]+$/.test(price) ? `$${price} USD · Kizkka` : "Disponible en Kizkka";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="product">
<meta property="og:site_name" content="Kizkka">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(target)}">
${image ? `<meta property="og:image" content="${esc(image)}"><meta property="og:image:secure_url" content="${esc(image)}"><meta name="twitter:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><script>location.replace(${JSON.stringify(target)})</script>
<a href="${esc(target)}">${esc(title)}</a></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
});
