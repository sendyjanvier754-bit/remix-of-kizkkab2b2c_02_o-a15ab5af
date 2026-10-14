// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAutomationSettings, runCartRecovery, runLowStockAlerts, DEFAULT_AUTOMATION } from "../_shared/automation.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body: any = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  try {
    // Scheduled run: idempotent and deduplicated, safe to trigger.
    if (action === "cron") {
      const s = await getAutomationSettings(admin);
      return json({ cart: await runCartRecovery(admin, s), stock: await runLowStockAlerts(admin, s) });
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: role } = await admin.from("user_roles").select("id").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "forbidden" }, 403);

    if (action === "get_settings") return json(await getAutomationSettings(admin));
    if (action === "save_settings") {
      const v = body.settings || {};
      const clean = {
        cart_recovery: { ...DEFAULT_AUTOMATION.cart_recovery, ...v.cart_recovery },
        seller_alerts: { ...DEFAULT_AUTOMATION.seller_alerts, ...v.seller_alerts },
      };
      clean.cart_recovery.delay_hours = Math.min(72, Math.max(1, Number(clean.cart_recovery.delay_hours) || 3));
      clean.cart_recovery.second_delay_hours = Math.min(168, Math.max(clean.cart_recovery.delay_hours + 1, Number(clean.cart_recovery.second_delay_hours) || 24));
      clean.cart_recovery.max_reminders = Math.min(2, Math.max(1, Number(clean.cart_recovery.max_reminders) || 1));
      clean.cart_recovery.coupon_code = String(clean.cart_recovery.coupon_code || "").slice(0, 40);
      clean.cart_recovery.template_id = /^[0-9a-f-]{36}$/i.test(String(clean.cart_recovery.template_id || "")) ? String(clean.cart_recovery.template_id) : "";
      clean.seller_alerts.low_stock_threshold = Math.min(100, Math.max(0, Number(clean.seller_alerts.low_stock_threshold) || 0));
      const value = JSON.stringify(clean);
      const { data: ex } = await admin.from("platform_settings").select("id").eq("key", "marketing_automation").maybeSingle();
      if (ex) await admin.from("platform_settings").update({ value }).eq("id", ex.id);
      else await admin.from("platform_settings").insert({ key: "marketing_automation", value, description: "Carritos abandonados y alertas a vendedores" });
      return json(clean);
    }
    if (action === "run_now") {
      const s = await getAutomationSettings(admin);
      return json({ cart: await runCartRecovery(admin, s), stock: await runLowStockAlerts(admin, s) });
    }
    if (action === "stats") {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: logs } = await admin.from("cart_recovery_logs").select("cart_total,recovered_at,recovered_amount,email_sent,whatsapp_sent,created_at,attempt,cart_type").gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
      const { data: sn } = await admin.from("seller_notification_logs").select("kind,email_sent,whatsapp_sent,created_at").gte("created_at", since).limit(1000);
      const L = logs || [];
      const recovered = L.filter((l: any) => l.recovered_at && l.attempt === 1 || (l.recovered_at && l.attempt > 1));
      return json({
        reminders: L.length,
        emails: L.filter((l: any) => l.email_sent).length,
        whatsapps: L.filter((l: any) => l.whatsapp_sent).length,
        abandoned_value: L.filter((l: any) => l.attempt === 1).reduce((a: number, l: any) => a + Number(l.cart_total || 0), 0),
        recovered_count: new Set(recovered.map((l: any) => l.recovered_at)).size,
        recovered_value: [...new Map(recovered.map((l: any) => [l.recovered_at, Number(l.recovered_amount || 0)])).values()].reduce((a, b) => a + b, 0),
        sale_alerts: (sn || []).filter((x: any) => x.kind === "new_sale").length,
        stock_alerts: (sn || []).filter((x: any) => x.kind === "low_stock").length,
        recent: L.slice(0, 20),
      });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("marketing-automation", e);
    return json({ error: (e as Error).message }, 500);
  }
});
