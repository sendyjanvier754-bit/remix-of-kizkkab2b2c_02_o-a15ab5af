// Public share page: serves Open Graph tags (product/variant image) for WhatsApp
// crawlers and instantly redirects humans to the real product page.
const SITE = "https://kizkka.com";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (u: string | null) => {
  if (!u) return "";
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : "";
  } catch {
    return "";
  }
};

Deno.serve((req) => {
  const url = new URL(req.url);
  const q = url.searchParams;
  const sku = (q.get("sku") || "").replace(/[^\w\-.]/g, "");
  const name = (q.get("name") || "Kizkka").slice(0, 200);
  const desc = (q.get("desc") || "").slice(0, 300);
  const img = safeUrl(q.get("img"));

  const target = new URL(`${SITE}/producto/${encodeURIComponent(sku)}`);
  for (const k of ["seller", "ref"]) {
    const v = q.get(k);
    if (v) target.searchParams.set(k, v.slice(0, 100));
  }
  const t = esc(target.toString());

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(name)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Kizkka">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${t}">
${img ? `<meta property="og:image" content="${esc(img)}"><meta property="og:image:secure_url" content="${esc(img)}"><meta name="twitter:image" content="${esc(img)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${t}">
</head><body><script>location.replace(${JSON.stringify(target.toString())})</script>
<a href="${t}">${esc(name)}</a></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
});
