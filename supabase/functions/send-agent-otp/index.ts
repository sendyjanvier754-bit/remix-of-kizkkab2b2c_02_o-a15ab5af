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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get the agent's JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify agent identity
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const agentClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: agentUser }, error: authError } = await agentClient.auth.getUser();
    if (authError || !agentUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check agent has required role
    const { data: hasRole } = await supabase.rpc("has_role", {
      _user_id: agentUser.id,
      _role: "admin",
    });
    const { data: hasSellerRole } = await supabase.rpc("has_role", {
      _user_id: agentUser.id,
      _role: "seller",
    });
    const { data: hasSalesAgentRole } = await supabase.rpc("has_role", {
      _user_id: agentUser.id,
      _role: "sales_agent",
    });

    if (!hasRole && !hasSellerRole && !hasSalesAgentRole) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Expire any previous pending sessions for same agent+target
    await supabase
      .from("agent_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("agent_id", agentUser.id)
      .eq("target_user_id", target_user_id)
      .eq("status", "pending_verification");

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        agent_id: agentUser.id,
        target_user_id,
        verification_code: code,
        code_expires_at: codeExpiresAt,
        status: "pending_verification",
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return new Response(JSON.stringify({ error: "Failed to create session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user info for notification
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", target_user_id)
      .single();

    // Send notification to user (in-app)
    const { data: notification } = await supabase.from("notifications").insert({
      user_id: target_user_id,
      title: "Código de verificación de agente",
      message: `Tu código de verificación es: ${code}. Compártelo con el agente para que pueda asistirte. Expira en 10 minutos.`,
      type: "agent_otp",
      data: { type: "agent_otp", session_id: session.id },
    }).select("id").single();

    // Send OTP via email
    if (targetProfile?.email) {
      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({
            notificationId: notification?.id,
            recipientEmail: targetProfile.email,
            recipientName: targetProfile.full_name || "Usuario",
            subject: "Tu código de verificación - Silver Market",
            title: "Código de verificación de agente",
            message: `Un agente necesita acceso a tu cuenta para asistirte. Tu código de verificación es: <strong style="font-size: 24px; letter-spacing: 4px; color: #071d7f;">${code}</strong><br><br>Este código expira en 10 minutos. No lo compartas si no solicitaste asistencia.`,
          }),
        });
        console.log("Email OTP sent:", await emailResponse.json());
      } catch (emailErr) {
        console.error("Failed to send OTP email (non-blocking):", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        target_user_name: targetProfile?.full_name || "Usuario",
        target_email: targetProfile?.email,
        expires_in_minutes: 10,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
