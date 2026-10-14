// Shared WhatsApp automation (Meta Cloud API, secrets WHATSAPP_API_KEY + WHATSAPP_PHONE_ID).
// Event toggles live in platform_settings key "whatsapp_automation". 4 languages.
// deno-lint-ignore-file no-explicit-any
import { normLang, type Lang } from "./transactional-email.ts";

export type WaKind = "paid" | "pending" | "shipped" | "ready_pickup" | "delivered";
const SITE = "https://kizkka.com";

const T: Record<Lang, Record<WaKind, string>> = {
  es: {
    pending: "Hola {name} 👋, registramos tu pedido #{order} por {total}. Si ya pagaste, sube tu comprobante aquí: {url}",
    paid: "✅ Hola {name}, confirmamos el pago de tu pedido #{order} ({total}). Ya estamos preparando tu compra. Detalles: {url}",
    shipped: "🚚 Hola {name}, tu pedido #{order} va en camino.{tracking} Sigue tu pedido: {url}",
    ready_pickup: "📦 Hola {name}, tu pedido #{order} está listo para recoger en tu punto de entrega.{pickup} Detalles: {url}",
    delivered: "🎉 Hola {name}, tu pedido #{order} fue entregado. ¡Gracias por comprar en Kizkka! {url}",
  },
  en: {
    pending: "Hi {name} 👋, we registered your order #{order} for {total}. If you already paid, upload your proof here: {url}",
    paid: "✅ Hi {name}, payment for order #{order} ({total}) is confirmed. We're preparing your purchase. Details: {url}",
    shipped: "🚚 Hi {name}, your order #{order} is on its way.{tracking} Track it: {url}",
    ready_pickup: "📦 Hi {name}, your order #{order} is ready for pickup at your delivery point.{pickup} Details: {url}",
    delivered: "🎉 Hi {name}, your order #{order} has been delivered. Thanks for shopping at Kizkka! {url}",
  },
  fr: {
    pending: "Bonjour {name} 👋, nous avons enregistré votre commande #{order} de {total}. Si vous avez déjà payé, envoyez votre preuve ici : {url}",
    paid: "✅ Bonjour {name}, le paiement de la commande #{order} ({total}) est confirmé. Nous préparons votre achat. Détails : {url}",
    shipped: "🚚 Bonjour {name}, votre commande #{order} est en route.{tracking} Suivi : {url}",
    ready_pickup: "📦 Bonjour {name}, votre commande #{order} est prête au point de retrait.{pickup} Détails : {url}",
    delivered: "🎉 Bonjour {name}, votre commande #{order} a été livrée. Merci d'avoir acheté sur Kizkka ! {url}",
  },
  ht: {
    pending: "Bonjou {name} 👋, nou anrejistre kòmand #{order} ou a pou {total}. Si ou te deja peye, voye prèv peman an la a: {url}",
    paid: "✅ Bonjou {name}, nou konfime peman kòmand #{order} ou a ({total}). N ap prepare acha ou. Detay: {url}",
    shipped: "🚚 Bonjou {name}, kòmand #{order} ou a sou wout.{tracking} Swiv li: {url}",
    ready_pickup: "📦 Bonjou {name}, kòmand #{order} ou a pare pou w vin chèche l nan pwen livrezon an.{pickup} Detay: {url}",
    delivered: "🎉 Bonjou {name}, kòmand #{order} ou a livre. Mèsi paske w achte sou Kizkka! {url}",
  },
};
const TRK: Record<Lang, string> = { es: " Rastreo: {code}", en: " Tracking: {code}", fr: " Suivi : {code}", ht: " Nimewo swivi: {code}" };
const PUP: Record<Lang, string> = { es: " Lugar: {p}", en: " Location: {p}", fr: " Lieu : {p}", ht: " Kote: {p}" };
const TEST: Record<Lang, string> = {
  es: "✅ Mensaje de prueba de Kizkka: las notificaciones por WhatsApp están funcionando.",
  en: "✅ Kizkka test message: WhatsApp notifications are working.",
  fr: "✅ Message test Kizkka : les notifications WhatsApp fonctionnent.",
  ht: "✅ Mesaj tès Kizkka: notifikasyon WhatsApp yo ap mache.",
};

export interface WaSettings { enabled: boolean; events: Record<WaKind, boolean>; template_language?: string }
export const DEFAULT_WA: WaSettings = { enabled: true, events: { pending: true, paid: true, shipped: true, ready_pickup: true, delivered: true } };

export async function getWaSettings(admin: any): Promise<WaSettings> {
  const { data } = await admin.from("platform_settings").select("value").eq("key", "whatsapp_automation").maybeSingle();
  try { const v = data?.value ? JSON.parse(data.value) : {}; return { ...DEFAULT_WA, ...v, events: { ...DEFAULT_WA.events, ...(v.events || {}) } }; }
  catch { return DEFAULT_WA; }
}

export const waConfigured = () => !!(Deno.env.get("WHATSAPP_API_KEY") && Deno.env.get("WHATSAPP_PHONE_ID"));
const digits = (p?: string | null) => (p || "").replace(/\D/g, "");

export async function sendWhatsAppText(to: string, body: string) {
  const key = Deno.env.get("WHATSAPP_API_KEY"), phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  if (!key || !phoneId) return { ok: false, error: "whatsapp_not_configured" };
  const num = digits(to);
  if (num.length < 8) return { ok: false, error: "invalid_phone" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: num, type: "text", text: { body, preview_url: true } }),
  });
  const txt = await r.text();
  if (!r.ok) { console.error(`WhatsApp send failed [${r.status}]: ${txt}`); return { ok: false, error: `meta_${r.status}`, details: txt }; }
  return { ok: true };
}

export async function sendWhatsAppTest(to: string, lang?: string) {
  return sendWhatsAppText(to, TEST[normLang(lang)]);
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

/** Deduplicated through order.metadata.wa_<kind>_sent_at. Never throws. */
export async function sendOrderWhatsApp(admin: any, table: "orders_b2b" | "orders_b2c", orderId: string, kind: WaKind, extra: { tracking?: string; pickup?: string } = {}) {
  try {
    if (!waConfigured()) return { ok: false, error: "whatsapp_not_configured" };
    const s = await getWaSettings(admin);
    if (!s.enabled || !s.events[kind]) return { ok: true, skipped: "disabled" };
    const flag = `wa_${kind}_sent_at`;
    const { data: o } = await admin.from(table).select("*").eq("id", orderId).maybeSingle();
    if (!o) return { ok: false, error: "order_not_found" };
    const meta = (o.metadata || {}) as Record<string, any>;
    if (meta[flag]) return { ok: true, skipped: "already_sent" };
    const buyerId = table === "orders_b2c" ? o.buyer_user_id : o.buyer_id;
    const { data: p } = buyerId ? await admin.from("profiles").select("full_name,phone").eq("id", buyerId).maybeSingle() : { data: null };
    const addr = (o.shipping_address || {}) as Record<string, any>;
    const phone = p?.phone || addr.phone || addr.telefono || meta.phone || "";
    if (!digits(phone)) return { ok: false, error: "no_phone" };
    let lang: Lang = "es";
    if (buyerId) { const { data } = await admin.auth.admin.getUserById(buyerId); lang = normLang(data?.user?.user_metadata?.preferred_language); }
    const cur = o.currency || "USD";
    const total = new Intl.NumberFormat("es", { style: "currency", currency: cur }).format(Number(o.total_amount || 0));
    const tracking = extra.tracking || meta.tracking_number || "";
    const pickup = extra.pickup || meta.pickup_point_name || addr.pickup_point_name || "";
    const body = fill(T[lang][kind], {
      name: (p?.full_name || "").split(" ")[0] || "",
      order: o.order_number || String(o.id).slice(0, 8).toUpperCase(),
      total,
      url: table === "orders_b2b" ? `${SITE}/seller/mis-compras` : `${SITE}/mis-compras`,
      tracking: tracking ? fill(TRK[lang], { code: tracking }) : "",
      pickup: pickup ? fill(PUP[lang], { p: pickup }) : "",
    });
    const res = await sendWhatsAppText(phone, body);
    if (res.ok) {
      const { data: fresh } = await admin.from(table).select("metadata").eq("id", orderId).maybeSingle();
      await admin.from(table).update({ metadata: { ...((fresh?.metadata as any) || {}), [flag]: new Date().toISOString() } }).eq("id", orderId);
    }
    return res;
  } catch (e) {
    console.error("sendOrderWhatsApp", e);
    return { ok: false, error: (e as Error).message };
  }
}

export function statusToWaKind(status: string): WaKind | null {
  const s = (status || "").toLowerCase();
  if (["shipped", "in_transit", "en_transito", "dispatched"].includes(s)) return "shipped";
  if (["ready_for_pickup", "ready_pickup", "at_pickup_point", "listo_para_recoger"].includes(s)) return "ready_pickup";
  if (["delivered", "entregado", "completed"].includes(s)) return "delivered";
  if (s === "paid") return "paid";
  return null;
}
