// Shared transactional email engine (Mailjet via email_configuration).
// Branded Kizkka layout, 4 languages (es, en, fr, ht).
// deno-lint-ignore-file no-explicit-any

export type Lang = "es" | "en" | "fr" | "ht";
export const normLang = (l?: string | null): Lang => {
  const v = (l || "").slice(0, 2).toLowerCase();
  return (["es", "en", "fr", "ht"].includes(v) ? v : "es") as Lang;
};

const SITE = "https://kizkka.com";

const T: Record<Lang, Record<string, string>> = {
  es: {
    footer: "Este es un mensaje automático de Kizkka.", rights: "Todos los derechos reservados.",
    welcomeSubject: "¡Bienvenido a Kizkka, {name}!", welcomeTitle: "¡Bienvenido a Kizkka!",
    welcomeBody: "Hola <strong>{name}</strong>, tu cuenta ha sido creada con éxito. Ya puedes descubrir miles de productos, comprar al por mayor o al detalle y seguir tus pedidos desde tu perfil.",
    welcomeCta: "Ir a mi cuenta", welcomeCta2: "Explorar catálogo",
    paidSubject: "Pago confirmado · Pedido #{order}", paidTitle: "¡Pago confirmado!",
    paidBody: "Hola <strong>{name}</strong>, hemos recibido tu pago del pedido <strong>#{order}</strong>. Empezamos a preparar tu compra y te avisaremos de cada avance.",
    pendSubject: "Pedido #{order} pendiente de pago", pendTitle: "Pedido pendiente de pago",
    pendBody: "Hola <strong>{name}</strong>, registramos tu pedido <strong>#{order}</strong>. Si ya realizaste el pago, sube tu comprobante para que podamos verificarlo.",
    pendCta: "Subir comprobante", ordersCta: "Ver mis pedidos",
    product: "Producto", qty: "Cant.", price: "Precio", total: "Total", method: "Método de pago",
  },
  en: {
    footer: "This is an automated message from Kizkka.", rights: "All rights reserved.",
    welcomeSubject: "Welcome to Kizkka, {name}!", welcomeTitle: "Welcome to Kizkka!",
    welcomeBody: "Hi <strong>{name}</strong>, your account has been created. You can now discover thousands of products, buy wholesale or retail and track your orders from your profile.",
    welcomeCta: "Go to my account", welcomeCta2: "Browse catalog",
    paidSubject: "Payment confirmed · Order #{order}", paidTitle: "Payment confirmed!",
    paidBody: "Hi <strong>{name}</strong>, we received your payment for order <strong>#{order}</strong>. We are preparing your purchase and will keep you updated.",
    pendSubject: "Order #{order} awaiting payment", pendTitle: "Order awaiting payment",
    pendBody: "Hi <strong>{name}</strong>, we registered your order <strong>#{order}</strong>. If you already paid, upload your proof of payment so we can verify it.",
    pendCta: "Upload proof", ordersCta: "View my orders",
    product: "Product", qty: "Qty", price: "Price", total: "Total", method: "Payment method",
  },
  fr: {
    footer: "Ceci est un message automatique de Kizkka.", rights: "Tous droits réservés.",
    welcomeSubject: "Bienvenue sur Kizkka, {name} !", welcomeTitle: "Bienvenue sur Kizkka !",
    welcomeBody: "Bonjour <strong>{name}</strong>, votre compte a été créé. Découvrez des milliers de produits, achetez en gros ou au détail et suivez vos commandes depuis votre profil.",
    welcomeCta: "Mon compte", welcomeCta2: "Voir le catalogue",
    paidSubject: "Paiement confirmé · Commande #{order}", paidTitle: "Paiement confirmé !",
    paidBody: "Bonjour <strong>{name}</strong>, nous avons reçu votre paiement pour la commande <strong>#{order}</strong>. Nous préparons votre achat et vous tiendrons informé.",
    pendSubject: "Commande #{order} en attente de paiement", pendTitle: "Commande en attente de paiement",
    pendBody: "Bonjour <strong>{name}</strong>, nous avons enregistré votre commande <strong>#{order}</strong>. Si vous avez déjà payé, envoyez votre justificatif pour vérification.",
    pendCta: "Envoyer le justificatif", ordersCta: "Voir mes commandes",
    product: "Produit", qty: "Qté", price: "Prix", total: "Total", method: "Moyen de paiement",
  },
  ht: {
    footer: "Sa a se yon mesaj otomatik Kizkka.", rights: "Tout dwa rezève.",
    welcomeSubject: "Byenvini sou Kizkka, {name}!", welcomeTitle: "Byenvini sou Kizkka!",
    welcomeBody: "Bonjou <strong>{name}</strong>, kont ou kreye avèk siksè. Ou ka dekouvri plizyè milye pwodwi, achte an gwo oswa an detay epi swiv kòmand ou nan pwofil ou.",
    welcomeCta: "Ale nan kont mwen", welcomeCta2: "Gade katalòg la",
    paidSubject: "Peman konfime · Kòmand #{order}", paidTitle: "Peman konfime!",
    paidBody: "Bonjou <strong>{name}</strong>, nou resevwa peman ou pou kòmand <strong>#{order}</strong>. N ap prepare acha ou epi n ap kenbe ou okouran.",
    pendSubject: "Kòmand #{order} ap tann peman", pendTitle: "Kòmand ap tann peman",
    pendBody: "Bonjou <strong>{name}</strong>, nou anrejistre kòmand ou <strong>#{order}</strong>. Si ou deja peye, voye prèv peman an pou nou verifye l.",
    pendCta: "Voye prèv peman", ordersCta: "Gade kòmand mwen yo",
    product: "Pwodwi", qty: "Kte", price: "Pri", total: "Total", method: "Metòd peman",
  },
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const money = (n: number, cur = "USD") => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n); } catch { return `${n.toFixed(2)} ${cur}`; } };
const btn = (href: string, label: string, primary = true) =>
  `<a href="${href}" style="display:inline-block;margin:6px 4px;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;${primary ? "background:#ce2e2e;color:#ffffff" : "background:#eef2ff;color:#071d7f"}">${label}</a>`;

async function brand(admin: any) {
  const { data } = await admin.from("branding_settings").select("key,value").in("key", ["platform_name", "logo_url", "site_name"]);
  const m: Record<string, string> = {};
  (data || []).forEach((r: any) => (m[r.key] = r.value));
  return { name: m.platform_name || m.site_name || "Kizkka", logo: m.logo_url || "" };
}

function layout(lang: Lang, b: { name: string; logo: string }, title: string, body: string) {
  const t = T[lang];
  const head = b.logo
    ? `<img src="${esc(b.logo)}" alt="${esc(b.name)}" style="max-height:44px">`
    : `<span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:.5px">${esc(b.name)}</span>`;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#071d7f;padding:24px;text-align:center;border-radius:14px 14px 0 0">${head}</div>
<div style="background:#ffffff;padding:30px;border-radius:0 0 14px 14px">
<h1 style="margin:0 0 14px;font-size:22px;color:#071d7f">${esc(title)}</h1>${body}</div>
<div style="text-align:center;padding:18px;color:#6b7280;font-size:12px"><p style="margin:0">${t.footer}</p><p style="margin:4px 0 0">© ${new Date().getFullYear()} ${esc(b.name)}. ${t.rights}</p></div>
</div></body></html>`;
}

export async function sendMail(admin: any, to: string, subject: string, html: string, type = "notifications") {
  const { data: cfg } = await admin.from("email_configuration").select("*").eq("is_active", true).limit(1).maybeSingle();
  if (!cfg?.api_key || !cfg?.api_secret) { console.warn("Email not configured"); return { ok: false, error: "not_configured" }; }
  let from = cfg.sender_email, fromName = cfg.sender_name || "Kizkka";
  const { data: s } = await admin.from("email_senders").select("sender_email,sender_name").eq("purpose", type).is("destination_country_id", null).eq("is_active", true).limit(1).maybeSingle();
  if (s?.sender_email?.includes("@")) { from = s.sender_email; fromName = s.sender_name || fromName; }
  if (/siver/i.test(fromName)) fromName = "Kizkka";
  const r = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(`${cfg.api_key.trim()}:${cfg.api_secret.trim()}`)}` },
    body: JSON.stringify({ Messages: [{ From: { Email: from, Name: fromName }, To: [{ Email: to }], Subject: subject, HTMLPart: html, CustomID: `kizkka-${type}-${Date.now()}` }] }),
  });
  if (!r.ok) { const e = await r.text(); console.error("Mailjet error", r.status, e); return { ok: false, error: e }; }
  return { ok: true };
}

async function userInfo(admin: any, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const u = data?.user;
  const { data: p } = await admin.from("profiles").select("full_name,email").eq("id", userId).maybeSingle();
  return {
    email: p?.email || u?.email || "",
    name: p?.full_name || u?.user_metadata?.full_name || (u?.email || "").split("@")[0],
    lang: normLang(u?.user_metadata?.preferred_language),
  };
}

export async function sendWelcome(admin: any, userId: string, langOverride?: string) {
  if (langOverride) {
    const { data } = await admin.auth.admin.getUserById(userId);
    await admin.auth.admin.updateUserById(userId, { user_metadata: { ...(data?.user?.user_metadata || {}), preferred_language: normLang(langOverride) } });
  }
  const u = await userInfo(admin, userId);
  if (!u.email) return { ok: false, error: "no_email" };
  const t = T[u.lang], b = await brand(admin), v = { name: esc(u.name) };
  const body = `<p style="font-size:15px;line-height:1.6">${fill(t.welcomeBody, v)}</p><div style="text-align:center;margin-top:22px">${btn(`${SITE}/perfil`, t.welcomeCta)}${btn(`${SITE}/`, t.welcomeCta2, false)}</div>`;
  return sendMail(admin, u.email, fill(t.welcomeSubject, { name: u.name }), layout(u.lang, b, t.welcomeTitle, body), "notifications");
}

/** kind: 'paid' | 'pending'. Deduplicated through order.metadata flags. */
export async function sendOrderEmail(admin: any, table: "orders_b2b" | "orders_b2c", orderId: string, kind: "paid" | "pending") {
  const flag = kind === "paid" ? "email_paid_sent_at" : "email_pending_sent_at";
  const { data: o } = await admin.from(table).select("*").eq("id", orderId).maybeSingle();
  if (!o) return { ok: false, error: "order_not_found" };
  const meta = (o.metadata || {}) as Record<string, any>;
  if (meta[flag]) return { ok: true, skipped: true };
  const buyerId = table === "orders_b2c" ? o.buyer_user_id : o.buyer_id;
  if (!buyerId) return { ok: false, error: "no_buyer" };
  const u = await userInfo(admin, buyerId);
  if (!u.email) return { ok: false, error: "no_email" };
  const t = T[u.lang], b = await brand(admin);
  const cur = o.currency || "USD";
  const orderNo = o.order_number || String(o.id).slice(0, 8).toUpperCase();

  let items: { n: string; q: number; p: number }[] = [];
  if (table === "orders_b2c") {
    const { data } = await admin.from("order_items_b2c").select("product_name,quantity,unit_price").eq("order_id", orderId);
    items = (data || []).map((i: any) => ({ n: i.product_name, q: i.quantity, p: Number(i.unit_price) }));
  } else {
    const { data } = await admin.from("order_items_b2b").select("nombre,cantidad,precio_unitario,color,size").eq("order_id", orderId);
    items = (data || []).map((i: any) => ({ n: [i.nombre, i.color, i.size].filter(Boolean).join(" · "), q: i.cantidad, p: Number(i.precio_unitario) }));
  }
  const rows = items.map((i) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${esc(i.n)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.q}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${money(i.p * i.q, cur)}</td></tr>`).join("");
  const table_ = items.length ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px"><thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">${t.product}</th><th style="padding:8px">${t.qty}</th><th style="padding:8px;text-align:right">${t.price}</th></tr></thead><tbody>${rows}</tbody></table>` : "";
  const v = { name: esc(u.name), order: esc(orderNo) };
  const ordersUrl = table === "orders_b2b" ? `${SITE}/seller/mis-compras` : `${SITE}/mis-compras`;
  const summary = `<div style="background:#f8fafc;border-radius:10px;padding:14px;margin:12px 0"><p style="margin:0;font-size:16px"><strong>${t.total}:</strong> <span style="color:#ce2e2e;font-weight:800">${money(Number(o.total_amount || 0), cur)}</span></p>${o.payment_method ? `<p style="margin:4px 0 0">${t.method}: ${esc(o.payment_method)}</p>` : ""}</div>`;
  const body = kind === "paid"
    ? `<p style="font-size:15px;line-height:1.6">${fill(t.paidBody, v)}</p>${table_}${summary}<div style="text-align:center">${btn(ordersUrl, t.ordersCta)}</div>`
    : `<p style="font-size:15px;line-height:1.6">${fill(t.pendBody, v)}</p>${table_}${summary}<div style="text-align:center">${btn(ordersUrl, t.pendCta)}</div>`;
  const subj = fill(kind === "paid" ? t.paidSubject : t.pendSubject, { order: orderNo });
  const res = await sendMail(admin, u.email, subj, layout(u.lang, b, kind === "paid" ? t.paidTitle : t.pendTitle, body), "orders");
  if (res.ok) {
    const { data: fresh } = await admin.from(table).select("metadata").eq("id", orderId).maybeSingle();
    await admin.from(table).update({ metadata: { ...((fresh?.metadata as any) || {}), [flag]: new Date().toISOString() } }).eq("id", orderId);
  }
  return res;
}

// ---------- Phase 3: logistics + review request emails ----------
export type LogiKind = "shipped" | "ready_pickup" | "delivered";
const L: Record<Lang, Record<string, string>> = {
  es: {
    shippedSubject: "Tu pedido #{order} está en camino 🚚", shippedTitle: "¡Tu pedido está en camino!",
    shippedBody: "Hola <strong>{name}</strong>, tu pedido <strong>#{order}</strong> ha sido despachado.",
    pickupSubject: "Pedido #{order} listo para retirar", pickupTitle: "Listo para retirar",
    pickupBody: "Hola <strong>{name}</strong>, tu pedido <strong>#{order}</strong> ya está disponible en tu punto de entrega. Presenta tu número de pedido al retirarlo.",
    deliveredSubject: "Pedido #{order} entregado ✅", deliveredTitle: "¡Pedido entregado!",
    deliveredBody: "Hola <strong>{name}</strong>, tu pedido <strong>#{order}</strong> fue entregado. ¡Gracias por comprar en Kizkka!",
    reviewTitle: "¿Qué te parecieron tus productos?", reviewBody: "Tu opinión ayuda a otros compradores. Califica tu compra en menos de un minuto:",
    rate: "Calificar", tracking: "Número de rastreo", carrier: "Transportista", point: "Punto de entrega", track: "Seguir mi pedido",
  },
  en: {
    shippedSubject: "Your order #{order} is on its way 🚚", shippedTitle: "Your order is on its way!",
    shippedBody: "Hi <strong>{name}</strong>, your order <strong>#{order}</strong> has been shipped.",
    pickupSubject: "Order #{order} ready for pickup", pickupTitle: "Ready for pickup",
    pickupBody: "Hi <strong>{name}</strong>, your order <strong>#{order}</strong> is available at your pickup point. Show your order number when collecting it.",
    deliveredSubject: "Order #{order} delivered ✅", deliveredTitle: "Order delivered!",
    deliveredBody: "Hi <strong>{name}</strong>, your order <strong>#{order}</strong> was delivered. Thank you for shopping at Kizkka!",
    reviewTitle: "How were your products?", reviewBody: "Your opinion helps other shoppers. Rate your purchase in under a minute:",
    rate: "Rate", tracking: "Tracking number", carrier: "Carrier", point: "Pickup point", track: "Track my order",
  },
  fr: {
    shippedSubject: "Votre commande #{order} est en route 🚚", shippedTitle: "Votre commande est en route !",
    shippedBody: "Bonjour <strong>{name}</strong>, votre commande <strong>#{order}</strong> a été expédiée.",
    pickupSubject: "Commande #{order} prête à retirer", pickupTitle: "Prête à retirer",
    pickupBody: "Bonjour <strong>{name}</strong>, votre commande <strong>#{order}</strong> est disponible à votre point de retrait. Présentez votre numéro de commande.",
    deliveredSubject: "Commande #{order} livrée ✅", deliveredTitle: "Commande livrée !",
    deliveredBody: "Bonjour <strong>{name}</strong>, votre commande <strong>#{order}</strong> a été livrée. Merci d'avoir acheté sur Kizkka !",
    reviewTitle: "Qu'avez-vous pensé de vos produits ?", reviewBody: "Votre avis aide les autres acheteurs. Notez votre achat en moins d'une minute :",
    rate: "Noter", tracking: "Numéro de suivi", carrier: "Transporteur", point: "Point de retrait", track: "Suivre ma commande",
  },
  ht: {
    shippedSubject: "Kòmand ou #{order} sou wout 🚚", shippedTitle: "Kòmand ou sou wout!",
    shippedBody: "Bonjou <strong>{name}</strong>, kòmand ou <strong>#{order}</strong> fin voye.",
    pickupSubject: "Kòmand #{order} pare pou w vin chèche", pickupTitle: "Pare pou w vin chèche",
    pickupBody: "Bonjou <strong>{name}</strong>, kòmand ou <strong>#{order}</strong> disponib nan pwen livrezon ou. Montre nimewo kòmand ou lè w ap vin pran l.",
    deliveredSubject: "Kòmand #{order} livre ✅", deliveredTitle: "Kòmand livre!",
    deliveredBody: "Bonjou <strong>{name}</strong>, kòmand ou <strong>#{order}</strong> livre. Mèsi paske w achte sou Kizkka!",
    reviewTitle: "Kisa w panse de pwodwi ou yo?", reviewBody: "Opinyon ou ede lòt achtè. Bay nòt pou acha ou an mwens pase yon minit:",
    rate: "Bay nòt", tracking: "Nimewo swivi", carrier: "Transpòtè", point: "Pwen livrezon", track: "Swiv kòmand mwen",
  },
};

export async function sendLogisticsEmail(admin: any, table: "orders_b2b" | "orders_b2c", orderId: string, kind: LogiKind, extra: { tracking?: string; carrier?: string } = {}) {
  const flag = `email_${kind}_sent_at`;
  const { data: o } = await admin.from(table).select("*").eq("id", orderId).maybeSingle();
  if (!o) return { ok: false, error: "order_not_found" };
  const meta = (o.metadata || {}) as Record<string, any>;
  if (meta[flag]) return { ok: true, skipped: true };
  const buyerId = table === "orders_b2c" ? o.buyer_user_id : o.buyer_id;
  if (!buyerId) return { ok: false, error: "no_buyer" };
  const u = await userInfo(admin, buyerId);
  if (!u.email) return { ok: false, error: "no_email" };
  const t = L[u.lang], b = await brand(admin);
  const orderNo = o.order_number || String(o.id).slice(0, 8).toUpperCase();
  const v = { name: esc(u.name), order: esc(orderNo) };
  const ordersUrl = table === "orders_b2b" ? `${SITE}/seller/mis-compras` : `${SITE}/mis-compras`;
  const box = (rows: string) => rows ? `<div style="background:#eff6ff;border-radius:10px;padding:14px;margin:14px 0">${rows}</div>` : "";
  const line = (k: string, val?: string | null) => val ? `<p style="margin:2px 0"><strong>${k}:</strong> ${esc(val)}</p>` : "";
  const tracking = extra.tracking || o.tracking_number || meta.tracking_number;
  const carrier = extra.carrier || o.carrier || meta.carrier;
  let title = "", subj = "", body = "";

  if (kind === "shipped") {
    title = t.shippedTitle; subj = fill(t.shippedSubject, { order: orderNo });
    body = `<p style="font-size:15px;line-height:1.6">${fill(t.shippedBody, v)}</p>${box(line(t.tracking, tracking) + line(t.carrier, carrier))}<div style="text-align:center">${btn(ordersUrl, t.track)}</div>`;
  } else if (kind === "ready_pickup") {
    let point = "";
    const pid = o.pickup_point_id || meta.pickup_point_id;
    if (pid) {
      const { data: p } = await admin.from("pickup_points").select("*").eq("id", pid).maybeSingle();
      if (p) point = [p.name, p.address].filter(Boolean).join(" — ");
    }
    title = t.pickupTitle; subj = fill(t.pickupSubject, { order: orderNo });
    body = `<p style="font-size:15px;line-height:1.6">${fill(t.pickupBody, v)}</p>${box(line(t.point, point) + line("#", orderNo))}<div style="text-align:center">${btn(ordersUrl, t.track)}</div>`;
  } else {
    title = t.deliveredTitle; subj = fill(t.deliveredSubject, { order: orderNo });
    let items: { id: string; n: string }[] = [];
    if (table === "orders_b2c") {
      const { data } = await admin.from("order_items_b2c").select("*").eq("order_id", orderId);
      items = (data || []).map((i: any) => ({ id: i.product_id || i.seller_catalog_id, n: i.product_name }));
    } else {
      const { data } = await admin.from("order_items_b2b").select("*").eq("order_id", orderId);
      items = (data || []).map((i: any) => ({ id: i.product_id, n: i.nombre }));
    }
    const pids = [...new Set(items.map((i) => i.id).filter(Boolean))];
    const skuMap: Record<string, string> = {};
    if (pids.length) {
      const { data: ps } = await admin.from("products").select("id,sku_interno").in("id", pids);
      (ps || []).forEach((p: any) => { if (p.sku_interno) skuMap[p.id] = p.sku_interno; });
    }
    const seen = new Set<string>();
    const rows = items.filter((i) => i.id && !seen.has(i.id) && seen.add(i.id)).slice(0, 5).map((i) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #eee">${esc(i.n)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right"><a href="${skuMap[i.id] ? `${SITE}/producto/${encodeURIComponent(skuMap[i.id])}?review=1#reviews` : ordersUrl}" style="color:#ce2e2e;font-weight:700;text-decoration:none">★★★★★ ${t.rate}</a></td></tr>`).join("");
    const review = `<div style="margin-top:22px;border-top:1px solid #eee;padding-top:18px"><h2 style="font-size:18px;color:#071d7f;margin:0 0 8px">${t.reviewTitle}</h2><p style="margin:0 0 8px">${t.reviewBody}</p>${rows ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>` : `<div style="text-align:center">${btn(ordersUrl, t.rate)}</div>`}</div>`;
    body = `<p style="font-size:15px;line-height:1.6">${fill(t.deliveredBody, v)}</p>${review}`;
  }
  const res = await sendMail(admin, u.email, subj, layout(u.lang, b, title, body), "orders");
  if (res.ok) {
    const { data: fresh } = await admin.from(table).select("metadata").eq("id", orderId).maybeSingle();
    const upd: Record<string, string> = { [flag]: new Date().toISOString() };
    if (kind === "delivered") upd.review_request_sent_at = upd[flag];
    await admin.from(table).update({ metadata: { ...((fresh?.metadata as any) || {}), ...upd } }).eq("id", orderId);
  }
  return res;
}
