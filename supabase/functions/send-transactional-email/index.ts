import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendOrderEmail, sendWelcome } from "../_shared/transactional-email.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: ud } = await admin.auth.getUser(token);
    const user = ud?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const event = String(body.event || "");
    const uuid = /^[0-9a-f-]{36}$/i;

    if (event === "welcome") {
      const { data: p } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
      const meta = user.user_metadata || {};
      if (meta.welcome_email_sent_at) return json({ ok: true, skipped: true });
      const r = await sendWelcome(admin, user.id, typeof body.lang === "string" ? body.lang : undefined);
      if (r.ok) {
        const { data } = await admin.auth.admin.getUserById(user.id);
        await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...(data?.user?.user_metadata || {}), welcome_email_sent_at: new Date().toISOString() } });
      }
      return json({ ...r, profile: !!p });
    }

    if (event === "language") {
      const { data } = await admin.auth.admin.getUserById(user.id);
      const lang = String(body.lang || "es").slice(0, 2);
      await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...(data?.user?.user_metadata || {}), preferred_language: lang } });
      return json({ ok: true });
    }

    if (event === "order_paid" || event === "order_pending") {
      const table = body.order_type === "b2b" ? "orders_b2b" : body.order_type === "b2c" ? "orders_b2c" : null;
      const id = String(body.order_id || "");
      if (!table || !uuid.test(id)) return json({ error: "invalid order" }, 400);
      const { data: o } = await admin.from(table).select("*").eq("id", id).maybeSingle();
      if (!o) return json({ error: "not found" }, 404);
      const buyer = table === "orders_b2c" ? o.buyer_user_id : o.buyer_id;
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      const isAdmin = (roles || []).length > 0;
      if (event === "order_paid") {
        if (!isAdmin) return json({ error: "forbidden" }, 403);
        if (o.payment_status !== "paid") return json({ error: "order not paid" }, 409);
        return json(await sendOrderEmail(admin, table, id, "paid"));
      }
      if (buyer !== user.id && !isAdmin) return json({ error: "forbidden" }, 403);
      return json(await sendOrderEmail(admin, table, id, "pending"));
    }
    return json({ error: "unknown event" }, 400);
  } catch (e) {
    console.error("send-transactional-email", e);
    return json({ error: (e as Error).message }, 500);
  }
});
