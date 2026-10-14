// deno-lint-ignore-file no-explicit-any
import { sendMail, normLang, type Lang } from "./transactional-email.ts";
import { sendWhatsAppText, waConfigured } from "./transactional-whatsapp.ts";

const SITE = "https://kizkka.com";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export interface AutomationSettings {
  cart_recovery: { enabled: boolean; delay_hours: number; second_delay_hours: number; max_reminders: number; email: boolean; whatsapp: boolean; coupon_code: string; template_id?: string };
  seller_alerts: { enabled: boolean; new_sale: boolean; low_stock: boolean; low_stock_threshold: number; email: boolean; whatsapp: boolean };
}
export const DEFAULT_AUTOMATION: AutomationSettings = {
  cart_recovery: { enabled: true, delay_hours: 3, second_delay_hours: 24, max_reminders: 2, email: true, whatsapp: true, coupon_code: "", template_id: "" },
  seller_alerts: { enabled: true, new_sale: true, low_stock: true, low_stock_threshold: 3, email: true, whatsapp: true },
};
export async function getAutomationSettings(admin: any): Promise<AutomationSettings> {
  const { data } = await admin.from("platform_settings").select("value").eq("key", "marketing_automation").maybeSingle();
  try {
    const v = data?.value ? JSON.parse(data.value) : {};
    return { cart_recovery: { ...DEFAULT_AUTOMATION.cart_recovery, ...(v.cart_recovery || {}) }, seller_alerts: { ...DEFAULT_AUTOMATION.seller_alerts, ...(v.seller_alerts || {}) } };
  } catch { return DEFAULT_AUTOMATION; }
}

async function userContact(admin: any, userId: string) {
  const { data: p } = await admin.from("profiles").select("email,full_name,phone").eq("id", userId).maybeSingle();
  let lang: Lang = "es";
  try { const { data } = await admin.auth.admin.getUserById(userId); lang = normLang(data?.user?.user_metadata?.preferred_language); } catch { /* ignore */ }
  return { email: p?.email as string | undefined, name: (p?.full_name as string) || "", phone: p?.phone as string | undefined, lang };
}

function shell(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#071d7f;padding:24px;text-align:center;border-radius:14px 14px 0 0"><span style="font-size:24px;font-weight:800;color:#fff">Kizkka</span></div>
<div style="background:#fff;padding:30px;border-radius:0 0 14px 14px"><h1 style="margin:0 0 14px;font-size:22px;color:#071d7f">${esc(title)}</h1>${body}</div>
<div style="text-align:center;padding:18px;color:#6b7280;font-size:12px">© ${new Date().getFullYear()} Kizkka</div></div></body></html>`;
}
const cta = (href: string, label: string) => `<div style="text-align:center;margin-top:22px"><a href="${href}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#ce2e2e;color:#fff;font-weight:700;text-decoration:none">${esc(label)}</a></div>`;

// ---------------- Cart recovery ----------------
const CR: Record<Lang, { s1: string; s2: string; title: string; intro: string; btn: string; coupon: string; wa: string }> = {
  es: { s1: "¿Olvidaste algo en tu carrito?", s2: "Tus productos te siguen esperando", title: "Tu carrito te espera", intro: "Hola {n}, guardamos estos productos para ti:", btn: "Volver a mi carrito", coupon: "Usa el código {c} para un descuento especial.", wa: "Hola {n} 👋 Dejaste {q} producto(s) en tu carrito Kizkka ({t}). Complétalo aquí: {u}" },
  en: { s1: "Did you forget something in your cart?", s2: "Your items are still waiting", title: "Your cart is waiting", intro: "Hi {n}, we saved these items for you:", btn: "Back to my cart", coupon: "Use code {c} for a special discount.", wa: "Hi {n} 👋 You left {q} item(s) in your Kizkka cart ({t}). Complete it here: {u}" },
  fr: { s1: "Vous avez oublié quelque chose ?", s2: "Vos articles vous attendent toujours", title: "Votre panier vous attend", intro: "Bonjour {n}, nous avons gardé ces articles pour vous :", btn: "Retour au panier", coupon: "Utilisez le code {c} pour une remise spéciale.", wa: "Bonjour {n} 👋 Vous avez laissé {q} article(s) dans votre panier Kizkka ({t}). Finalisez ici : {u}" },
  ht: { s1: "Ou bliye yon bagay nan panye w?", s2: "Pwodwi ou yo ap tann ou toujou", title: "Panye w ap tann ou", intro: "Bonjou {n}, nou kenbe pwodwi sa yo pou ou:", btn: "Retounen nan panye m", coupon: "Sèvi ak kòd {c} pou yon rabè espesyal.", wa: "Bonjou {n} 👋 Ou kite {q} pwodwi nan panye Kizkka ou ({t}). Fini l isit: {u}" },
};
const f = (s: string, v: Record<string, string>) => s.replace(/\{(\w)\}/g, (_, k) => v[k] ?? "");

export async function runCartRecovery(admin: any, s: AutomationSettings) {
  const cfg = s.cart_recovery;
  const res = { processed: 0, sent: 0, recovered: 0 };
  // 1) mark recoveries: reminder then order placed by same user afterwards
  const { data: open } = await admin.from("cart_recovery_logs").select("id,user_id,created_at,cart_type").is("recovered_at", null).gte("created_at", new Date(Date.now() - 14 * 864e5).toISOString()).limit(500);
  for (const l of open || []) {
    const table = l.cart_type === "b2b" ? "orders_b2b" : "orders_b2c";
    const col = l.cart_type === "b2b" ? "buyer_id" : "buyer_user_id";
    const { data: o } = await admin.from(table).select("id,total_amount,created_at").eq(col, l.user_id).gt("created_at", l.created_at).order("created_at").limit(1).maybeSingle();
    if (o) { await admin.from("cart_recovery_logs").update({ recovered_at: o.created_at, recovered_order_id: o.id, recovered_amount: o.total_amount }).eq("user_id", l.user_id).is("recovered_at", null).lte("created_at", o.created_at); res.recovered++; }
  }
  if (!cfg.enabled) return res;
  const delays = [cfg.delay_hours, cfg.second_delay_hours];
  for (const type of ["b2c", "b2b"] as const) {
    const cartT = type === "b2c" ? "b2c_carts" : "b2b_carts", itemT = type === "b2c" ? "b2c_cart_items" : "b2b_cart_items", userCol = type === "b2c" ? "user_id" : "buyer_user_id";
    const cutoff = new Date(Date.now() - cfg.delay_hours * 36e5).toISOString();
    const { data: carts } = await admin.from(cartT).select(`id,${userCol},updated_at,status`).eq("status", "open").lte("updated_at", cutoff).gte("updated_at", new Date(Date.now() - 7 * 864e5).toISOString()).limit(200);
    for (const c of carts || []) {
      const userId = c[userCol]; if (!userId) continue;
      const { data: logs } = await admin.from("cart_recovery_logs").select("attempt,created_at").eq("cart_id", c.id).order("attempt", { ascending: false });
      const last = logs?.[0];
      // Reset if cart changed after last reminder
      if (last && new Date(c.updated_at) > new Date(last.created_at)) continue;
      const attempt = (last?.attempt || 0) + 1;
      if (attempt > Math.min(cfg.max_reminders, 2)) continue;
      const due = new Date(c.updated_at).getTime() + (delays[attempt - 1] ?? 24) * 36e5;
      if (Date.now() < due) continue;
      const { data: items } = await admin.from(itemT).select("nombre,quantity,total_price,image").eq("cart_id", c.id).limit(20);
      if (!items?.length) continue;
      res.processed++;
      const total = items.reduce((a: number, i: any) => a + Number(i.total_price || 0), 0);
      const qty = items.reduce((a: number, i: any) => a + Number(i.quantity || 0), 0);
      const { error: insErr } = await admin.from("cart_recovery_logs").insert({ cart_id: c.id, cart_type: type, user_id: userId, attempt, cart_total: total, items_count: qty });
      if (insErr) continue; // dedup
      const u = await userContact(admin, userId); const t = CR[u.lang];
      const url = `${SITE}${type === "b2b" ? "/seller/carrito" : "/carrito"}`;
      let emailOk = false, waOk = false;
      if (cfg.email && u.email) {
        const rows = items.map((i: any) => `<tr><td style="padding:8px 0;width:60px">${i.image ? `<img src="${esc(i.image)}" width="52" height="52" style="border-radius:8px;object-fit:cover">` : ""}</td><td style="padding:8px">${esc(i.nombre)} × ${i.quantity}</td><td style="padding:8px;text-align:right;font-weight:700">${money(i.total_price)}</td></tr>`).join("");
        const coupon = cfg.coupon_code ? `<p style="background:#fef3c7;padding:12px;border-radius:10px;text-align:center">${esc(f(t.coupon, { c: cfg.coupon_code }))}</p>` : "";
        let html = shell(t.title, `<p>${esc(f(t.intro, { n: u.name }))}</p><table style="width:100%;border-collapse:collapse">${rows}</table><p style="text-align:right;font-size:17px;font-weight:800">${money(total)}</p>${coupon}${cta(url, t.btn)}`);
        let subject = attempt === 1 ? t.s1 : t.s2;
        if (cfg.template_id) {
          const { data: tpl } = await admin.from("email_templates").select("subject,html_content").eq("id", cfg.template_id).maybeSingle();
          if (tpl?.html_content) {
            const table = `<table style="width:100%;border-collapse:collapse">${rows}</table>`;
            const fill = (x: string) => x.replace(/\{nombre\}|\{name\}/g, esc(u.name)).replace(/\{productos\}/g, table).replace(/\{total\}/g, money(total)).replace(/\{enlace_carrito\}/g, url).replace(/\{unsubscribe_url\}/g, `${SITE}/unsubscribe`);
            html = fill(tpl.html_content); if (tpl.subject) subject = fill(tpl.subject);
          }
        }
        try { const r: any = await sendMail(admin, u.email, subject, html, "marketing"); emailOk = !!r?.ok; } catch (e) { console.error("cart email", e); }
      }
      if (cfg.whatsapp && u.phone && waConfigured()) {
        const r: any = await sendWhatsAppText(u.phone, f(t.wa, { n: u.name, q: String(qty), t: money(total), u: url })); waOk = !!r?.ok;
      }
      await admin.from("cart_recovery_logs").update({ email_sent: emailOk, whatsapp_sent: waOk }).eq("cart_id", c.id).eq("attempt", attempt);
      if (emailOk || waOk) res.sent++;
    }
  }
  return res;
}

// ---------------- Seller alerts ----------------
async function storeOwner(admin: any, storeId: string) {
  const { data: st } = await admin.from("stores").select("id,name,owner_user_id,whatsapp").eq("id", storeId).maybeSingle();
  if (!st?.owner_user_id) return null;
  const u = await userContact(admin, st.owner_user_id);
  return { ...u, phone: st.whatsapp || u.phone, store: st.name as string };
}
async function claim(admin: any, kind: string, refId: string, storeId: string | null, refKey = "") {
  const { error } = await admin.from("seller_notification_logs").insert({ kind, ref_id: refId, ref_key: refKey, store_id: storeId });
  return !error;
}

const SALE: Record<Lang, { s: string; title: string; intro: string; net: string; ship: string; btn: string; wa: string }> = {
  es: { s: "🎉 Nueva venta #{o}", title: "¡Tienes una nueva venta!", intro: "Tu tienda {st} recibió un pedido pagado.", net: "Monto neto estimado", ship: "Enviar a", btn: "Ver pedido", wa: "🎉 Nueva venta en {st}: pedido #{o}, {q} artículo(s), neto {t}. Prepáralo aquí: {u}" },
  en: { s: "🎉 New sale #{o}", title: "You have a new sale!", intro: "Your store {st} received a paid order.", net: "Estimated net amount", ship: "Ship to", btn: "View order", wa: "🎉 New sale at {st}: order #{o}, {q} item(s), net {t}. Prepare it here: {u}" },
  fr: { s: "🎉 Nouvelle vente #{o}", title: "Vous avez une nouvelle vente !", intro: "Votre boutique {st} a reçu une commande payée.", net: "Montant net estimé", ship: "Livrer à", btn: "Voir la commande", wa: "🎉 Nouvelle vente chez {st} : commande #{o}, {q} article(s), net {t}. Préparez-la ici : {u}" },
  ht: { s: "🎉 Nouvo vant #{o}", title: "Ou gen yon nouvo vant!", intro: "Boutik ou {st} resevwa yon kòmand ki peye.", net: "Montan nèt estime", ship: "Voye bay", btn: "Wè kòmand lan", wa: "🎉 Nouvo vant nan {st}: kòmand #{o}, {q} atik, nèt {t}. Prepare l isit: {u}" },
};
const fx = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export async function sendSellerSaleAlert(admin: any, orderId: string) {
  const s = await getAutomationSettings(admin); const cfg = s.seller_alerts;
  if (!cfg.enabled || !cfg.new_sale) return { skipped: true };
  const { data: o } = await admin.from("orders_b2c").select("id,order_number,store_id,total_amount,commission_amount,shipping_address,payment_status").eq("id", orderId).maybeSingle();
  if (!o?.store_id || o.payment_status !== "paid") return { skipped: true };
  if (!(await claim(admin, "new_sale", o.id, o.store_id))) return { skipped: "duplicate" };
  const owner = await storeOwner(admin, o.store_id); if (!owner) return { skipped: "no_owner" };
  const { data: items } = await admin.from("order_items_b2c").select("product_name,quantity,total_price").eq("order_id", o.id);
  const t = SALE[owner.lang]; const num = o.order_number || o.id.slice(0, 8);
  const net = Number(o.total_amount || 0) - Number(o.commission_amount || 0);
  const qty = (items || []).reduce((a: number, i: any) => a + Number(i.quantity || 0), 0);
  const url = `${SITE}/seller/pedidos`;
  const addr = o.shipping_address || {};
  const addrTxt = [addr.full_name || addr.name, addr.street || addr.address, addr.commune, addr.department, addr.phone].filter(Boolean).join(", ");
  let emailOk = false, waOk = false;
  if (cfg.email && owner.email) {
    const rows = (items || []).map((i: any) => `<tr><td style="padding:6px 0">${esc(i.product_name)} × ${i.quantity}</td><td style="text-align:right">${money(i.total_price)}</td></tr>`).join("");
    const html = shell(t.title, `<p>${esc(fx(t.intro, { st: owner.store }))}</p><p><b>#${esc(num)}</b></p><table style="width:100%">${rows}</table>
<p style="font-size:17px"><b>${t.net}:</b> ${money(net)}</p>${addrTxt ? `<p><b>${t.ship}:</b> ${esc(addrTxt)}</p>` : ""}${cta(url, t.btn)}`);
    try { const r: any = await sendMail(admin, owner.email, fx(t.s, { o: num }), html, "orders"); emailOk = !!r?.ok; } catch (e) { console.error(e); }
  }
  if (cfg.whatsapp && owner.phone && waConfigured()) { const r: any = await sendWhatsAppText(owner.phone, fx(t.wa, { st: owner.store, o: num, q: String(qty), t: money(net), u: url })); waOk = !!r?.ok; }
  await admin.from("seller_notification_logs").update({ email_sent: emailOk, whatsapp_sent: waOk }).eq("kind", "new_sale").eq("ref_id", o.id);
  return { email: emailOk, whatsapp: waOk };
}

const LOW: Record<Lang, { s: string; title: string; intro: string; btn: string; wa: string }> = {
  es: { s: "⚠️ Stock bajo en {st}", title: "Productos con stock crítico", intro: "Estos productos están por agotarse:", btn: "Gestionar inventario", wa: "⚠️ Stock bajo en {st}: {l}. Reabastece aquí: {u}" },
  en: { s: "⚠️ Low stock at {st}", title: "Products with critical stock", intro: "These products are running out:", btn: "Manage inventory", wa: "⚠️ Low stock at {st}: {l}. Restock here: {u}" },
  fr: { s: "⚠️ Stock faible chez {st}", title: "Produits en stock critique", intro: "Ces produits sont presque épuisés :", btn: "Gérer l'inventaire", wa: "⚠️ Stock faible chez {st} : {l}. Réapprovisionnez ici : {u}" },
  ht: { s: "⚠️ Stòk ba nan {st}", title: "Pwodwi ki gen stòk kritik", intro: "Pwodwi sa yo prèske fini:", btn: "Jere envantè", wa: "⚠️ Stòk ba nan {st}: {l}. Ranplis isit: {u}" },
};

export async function runLowStockAlerts(admin: any, s: AutomationSettings) {
  const cfg = s.seller_alerts; const res = { stores: 0 };
  if (!cfg.enabled || !cfg.low_stock) return res;
  const { data: rows } = await admin.from("seller_catalog").select("id,seller_store_id,nombre,stock").eq("is_active", true).lte("stock", cfg.low_stock_threshold).limit(1000);
  const day = new Date().toISOString().slice(0, 10);
  const byStore = new Map<string, any[]>();
  (rows || []).forEach((r: any) => { if (r.seller_store_id) byStore.set(r.seller_store_id, [...(byStore.get(r.seller_store_id) || []), r]); });
  for (const [storeId, list] of byStore) {
    if (!(await claim(admin, "low_stock", storeId, storeId, day))) continue;
    const owner = await storeOwner(admin, storeId); if (!owner) continue;
    const t = LOW[owner.lang]; const url = `${SITE}/seller/inventario`;
    let emailOk = false, waOk = false;
    if (cfg.email && owner.email) {
      const li = list.slice(0, 30).map((p) => `<li>${esc(p.nombre)} — <b>${p.stock ?? 0}</b></li>`).join("");
      try { const r: any = await sendMail(admin, owner.email, fx(t.s, { st: owner.store }), shell(t.title, `<p>${t.intro}</p><ul>${li}</ul>${cta(url, t.btn)}`), "notifications"); emailOk = !!r?.ok; } catch (e) { console.error(e); }
    }
    if (cfg.whatsapp && owner.phone && waConfigured()) {
      const l = list.slice(0, 5).map((p) => `${p.nombre} (${p.stock ?? 0})`).join(", ");
      const r: any = await sendWhatsAppText(owner.phone, fx(t.wa, { st: owner.store, l, u: url })); waOk = !!r?.ok;
    }
    await admin.from("seller_notification_logs").update({ email_sent: emailOk, whatsapp_sent: waOk }).eq("kind", "low_stock").eq("ref_id", storeId).eq("ref_key", day);
    res.stores++;
  }
  return res;
}
