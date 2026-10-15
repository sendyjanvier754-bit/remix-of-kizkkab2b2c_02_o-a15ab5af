// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendMail, normLang } from "../_shared/transactional-email.ts";

const SITE = "https://kizkka.com";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const UNSUB: Record<string, string> = {
  es: "¿No quieres recibir más correos? Darte de baja", en: "Don't want these emails? Unsubscribe",
  fr: "Vous ne souhaitez plus recevoir ces e-mails ? Se désabonner", ht: "Ou pa vle resevwa imel sa yo ankò? Dezabòne",
};

function render(c: any, r: { name: string; lang: string; token: string }, logo: string, brandName: string) {
  const fill = (s: string) => (s || "").replace(/\{nombre\}|\{name\}/g, esc(r.name)).replace(/\{enlace_tienda\}/g, SITE);
  const lang = normLang(r.lang);
  const head = logo ? `<img src="${esc(logo)}" alt="${esc(brandName)}" style="max-height:44px">` : `<span style="font-size:24px;font-weight:800;color:#fff">${esc(brandName)}</span>`;
  const cta = c.cta_label && c.cta_url ? `<div style="text-align:center;margin-top:22px"><a href="${esc(c.cta_url)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#ce2e2e;color:#fff;font-weight:700;text-decoration:none">${esc(c.cta_label)}</a></div>` : "";
  const unsub = `${SITE}/unsubscribe?token=${r.token}`;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937">
<span style="display:none;max-height:0;overflow:hidden">${esc(c.preheader || "")}</span>
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#071d7f;padding:24px;text-align:center;border-radius:14px 14px 0 0">${head}</div>
<div style="background:#fff;padding:30px;border-radius:0 0 14px 14px;font-size:15px;line-height:1.6">${fill(c.html_content)}${cta}</div>
<div style="text-align:center;padding:18px;color:#6b7280;font-size:12px"><p style="margin:0">© ${new Date().getFullYear()} ${esc(brandName)}</p>
<p style="margin:6px 0 0"><a href="${unsub}" style="color:#6b7280">${UNSUB[lang]}</a></p></div></div></body></html>`;
}

async function audience(admin: any, segment: string, language: string) {
  const map = new Map<string, { email: string; name: string; lang: string; user_id?: string }>();
  const { data: unsubRows } = await admin.from("email_subscribers").select("email").eq("status", "unsubscribed");
  const blocked = new Set((unsubRows || []).map((r: any) => r.email.toLowerCase()));
  if (segment === "all" || segment === "subscribers") {
    const { data } = await admin.from("email_subscribers").select("email,full_name,language").eq("status", "subscribed").limit(10000);
    (data || []).forEach((s: any) => map.set(s.email.toLowerCase(), { email: s.email, name: s.full_name || "", lang: s.language }));
  }
  if (segment !== "subscribers") {
    let ids: string[] | null = null;
    if (segment === "buyers" || segment === "sellers") {
      const roles = segment === "sellers" ? ["seller"] : ["user"];
      const { data } = await admin.from("user_roles").select("user_id").in("role", roles).limit(10000);
      ids = (data || []).map((r: any) => r.user_id);
    }
    let q = admin.from("profiles").select("id,email,full_name").not("email", "is", null).limit(10000);
    if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const { data } = await q;
    (data || []).forEach((p: any) => {
      const k = String(p.email).toLowerCase();
      if (!map.has(k)) map.set(k, { email: p.email, name: p.full_name || "", lang: "es", user_id: p.id });
    });
  }
  let list = [...map.values()].filter((r) => r.email.includes("@") && !blocked.has(r.email.toLowerCase()));
  if (language !== "all") list = list.filter((r) => normLang(r.lang) === language);
  return list;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = String(body.action || "");

  // Public: unsubscribe by token
  if (action === "unsubscribe") {
    const token = String(body.token || "");
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "invalid_token" }, 400);
    const { data } = await admin.from("email_subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("unsubscribe_token", token).select("email").maybeSingle();
    return data ? json({ ok: true, email: data.email }) : json({ error: "not_found" }, 404);
  }

  // Admin actions
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return json({ error: "unauthorized" }, 401);
  const { data: u } = await admin.auth.getUser(auth);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: role } = await admin.from("user_roles").select("id").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "forbidden" }, 403);

  const { data: bs } = await admin.from("branding_settings").select("key,value").in("key", ["platform_name", "logo_url", "site_name"]);
  const bm: Record<string, string> = {}; (bs || []).forEach((r: any) => (bm[r.key] = r.value));
  const brandName = bm.platform_name || bm.site_name || "Kizkka", logo = bm.logo_url || "";

  if (action === "count") {
    const list = await audience(admin, String(body.segment || "all"), String(body.language || "all"));
    return json({ count: list.length });
  }

  if (action === "history") {
    const { data: camps } = await admin.from("email_campaigns").select("id,name,subject,segment,status,recipients_count,sent_count,failed_count,sent_at,created_at").neq("status", "draft").order("created_at", { ascending: false }).limit(50);
    const ids = (camps || []).map((c: any) => c.id);
    const { data: sends } = ids.length ? await admin.from("email_campaign_sends").select("campaign_id,email,status,error,created_at").in("campaign_id", ids).order("created_at", { ascending: false }).limit(2000) : { data: [] };
    return json({ campaigns: camps || [], sends: sends || [] });
  }



  // ---- Designer helpers ----
  if (action === "search_users") {
    const q = String(body.q || "").replace(/[%,()]/g, "").slice(0, 60);
    let qq = admin.from("profiles").select("id,email,full_name").not("email", "is", null).order("full_name").limit(30);
    if (q) qq = qq.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    const { data } = await qq;
    return json({ users: data || [] });
  }
  if (action === "list_coupons") {
    const { data } = await admin.from("discount_codes").select("id,code,discount_type,discount_value,min_purchase_amount,valid_until,is_active").eq("is_active", true).is("store_id", null).order("created_at", { ascending: false }).limit(50);
    return json({ coupons: data || [] });
  }
  if (action === "create_coupon") {
    const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
    const type = body.discount_type === "fixed" ? "fixed" : "percentage";
    const value = Number(body.discount_value);
    if (code.length < 3 || !(value > 0) || (type === "percentage" && value > 100)) return json({ error: "invalid_coupon" }, 400);
    const row: any = { code, discount_type: type, discount_value: value, created_by: u.user.id, is_active: true, description: String(body.description || "").slice(0, 200) || null,
      min_purchase_amount: Number(body.min_purchase_amount) || null, max_uses: Number(body.max_uses) || null, max_uses_per_user: 1,
      valid_from: new Date().toISOString(), valid_until: body.valid_until ? new Date(body.valid_until).toISOString() : null };
    const { data, error } = await admin.from("discount_codes").insert(row).select("id,code,discount_type,discount_value").single();
    if (error) return json({ error: error.code === "23505" ? "code_exists" : error.message }, 400);
    return json({ coupon: data });
  }
  if (action === "send_direct") {
    const subject = String(body.subject || "").slice(0, 200);
    const html = String(body.html || "");
    if (!subject || html.length < 20 || html.length > 500000) return json({ error: "invalid_content" }, 400);
    let list: { email: string; name: string; lang: string; user_id?: string }[] = [];
    if (Array.isArray(body.user_ids) && body.user_ids.length) {
      const ids = body.user_ids.filter((x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 1000);
      const { data } = await admin.from("profiles").select("id,email,full_name").in("id", ids);
      list = (data || []).filter((p: any) => p.email).map((p: any) => ({ email: p.email, name: p.full_name || "", lang: "es", user_id: p.id }));
      const { data: un } = await admin.from("email_subscribers").select("email").eq("status", "unsubscribed");
      const b = new Set((un || []).map((r: any) => r.email.toLowerCase()));
      list = list.filter((r) => !b.has(r.email.toLowerCase()));
    } else {
      list = await audience(admin, String(body.segment || "all"), String(body.language || "all"));
    }
    if (!list.length) return json({ error: "no_recipients" }, 400);
    await admin.from("email_subscribers").upsert(list.map((r) => ({ email: r.email, full_name: r.name || null, user_id: r.user_id || null, language: normLang(r.lang), source: r.user_id ? "account" : "newsletter" })), { onConflict: "email", ignoreDuplicates: true });
    const { data: toks } = await admin.from("email_subscribers").select("email,unsubscribe_token").in("email", list.map((r) => r.email));
    const tok = new Map((toks || []).map((t: any) => [t.email.toLowerCase(), t.unsubscribe_token]));
    const { data: camp } = await admin.from("email_campaigns").insert({ name: String(body.name || subject).slice(0, 200), subject, html_content: "", segment: Array.isArray(body.user_ids) && body.user_ids.length ? "direct" : String(body.segment || "all"), language: "all", status: "sending", recipients_count: list.length, created_by: u.user.id }).select("id").single();
    let sent = 0, failed = 0; const errors: string[] = [];
    for (let i = 0; i < list.length; i += 10) {
      const res = await Promise.all(list.slice(i, i + 10).map(async (r) => {
        const fill = (s: string) => s.replace(/\{nombre\}|\{name\}/g, esc(r.name)).replace(/\{unsubscribe_url\}/g, `${SITE}/unsubscribe?token=${tok.get(r.email.toLowerCase()) || ""}`);
        const out: any = await sendMail(admin, r.email, fill(subject).replace(/&amp;/g, "&"), fill(html), "marketing").catch((e) => ({ ok: false, error: String(e) }));
        return { campaign_id: camp?.id, email: r.email, status: out?.ok ? "sent" : "failed", error: out?.ok ? null : String(out?.error || "unknown").slice(0, 500) };
      }));
      res.forEach((x) => { if (x.status === "sent") sent++; else { failed++; if (x.error && errors.length < 3) errors.push(x.error); } });
      if (camp?.id) await admin.from("email_campaign_sends").upsert(res, { onConflict: "campaign_id,email" });
    }
    if (camp?.id) await admin.from("email_campaigns").update({ status: failed && !sent ? "failed" : "sent", sent_at: new Date().toISOString(), sent_count: sent, failed_count: failed }).eq("id", camp.id);
    return json({ recipients: list.length, sent, failed, errors });
  }


  const { data: c } = await admin.from("email_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
  if (!c) return json({ error: "campaign_not_found" }, 404);

  if (action === "test") {
    const to = String(body.email || u.user.email || "");
    if (!to.includes("@")) return json({ error: "invalid_email" }, 400);
    const r = await sendMail(admin, to, `[TEST] ${c.subject}`, render(c, { name: "Test", lang: "es", token: "00000000-0000-0000-0000-000000000000" }, logo, brandName), "marketing");
    return json(r, r.ok ? 200 : 500);
  }

  if (action === "send") {
    if (c.status === "sending" || c.status === "sent") return json({ error: "already_sent" }, 409);
    const list = await audience(admin, c.segment, c.language);
    await admin.from("email_campaigns").update({ status: "sending", recipients_count: list.length }).eq("id", c.id);
    // ensure every recipient has an unsubscribe token
    for (let i = 0; i < list.length; i += 500) {
      await admin.from("email_subscribers").upsert(list.slice(i, i + 500).map((r) => ({ email: r.email, full_name: r.name || null, user_id: r.user_id || null, language: normLang(r.lang), source: r.user_id ? "account" : "newsletter" })), { onConflict: "email", ignoreDuplicates: true });
    }
    const { data: toks } = await admin.from("email_subscribers").select("email,unsubscribe_token").limit(20000);
    const tok = new Map((toks || []).map((t: any) => [t.email.toLowerCase(), t.unsubscribe_token]));

    const work = (async () => {
      let sent = 0, failed = 0;
      for (let i = 0; i < list.length; i += 10) {
        const batch = list.slice(i, i + 10);
        const res = await Promise.all(batch.map(async (r) => {
          const subj = c.subject.replace(/\{nombre\}|\{name\}/g, r.name || "");
          const out = await sendMail(admin, r.email, subj, render(c, { name: r.name, lang: r.lang, token: tok.get(r.email.toLowerCase()) || "" }, logo, brandName), "marketing").catch((e) => ({ ok: false, error: String(e) }));
          return { campaign_id: c.id, email: r.email, status: out.ok ? "sent" : "failed", error: out.ok ? null : String((out as any).error).slice(0, 500) };
        }));
        res.forEach((x) => (x.status === "sent" ? sent++ : failed++));
        await admin.from("email_campaign_sends").upsert(res, { onConflict: "campaign_id,email" });
        await admin.from("email_campaigns").update({ sent_count: sent, failed_count: failed }).eq("id", c.id);
        await new Promise((r) => setTimeout(r, 1000));
      }
      await admin.from("email_campaigns").update({ status: "sent", sent_at: new Date().toISOString(), sent_count: sent, failed_count: failed }).eq("id", c.id);
    })();
    // @ts-ignore EdgeRuntime is available in Supabase
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
    return json({ ok: true, recipients: list.length });
  }

  return json({ error: "unknown_action" }, 400);
});
