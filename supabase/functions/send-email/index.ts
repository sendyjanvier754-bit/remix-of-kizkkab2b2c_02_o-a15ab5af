import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  type?: "auth" | "marketing" | "communication" | "test";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client to read email config (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch email configuration from DB
    const { data: configs, error: configError } = await supabaseAdmin
      .from("email_configuration")
      .select("*")
      .eq("is_active", true)
      .limit(1);

    if (configError) {
      console.error("Error fetching email config:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Error al leer la configuración de email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = configs?.[0];

    if (!config || !config.api_key || !config.api_secret) {
      return new Response(
        JSON.stringify({ success: false, error: "Email no configurado. Configure las credenciales de Mailjet en el panel de administración." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: EmailRequest = await req.json();
    const { to, subject, htmlContent, textContent, type } = body;

    if (!to || !subject || !htmlContent) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos requeridos: to, subject, htmlContent" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build recipients array
    const recipients = Array.isArray(to)
      ? to.map((email) => ({ Email: email }))
      : [{ Email: to }];

    // Send via Mailjet API v3.1
    const mailjetPayload = {
      Messages: [
        {
          From: {
            Email: config.sender_email,
            Name: config.sender_name || "Siver",
          },
          To: recipients,
          Subject: subject,
          HTMLPart: htmlContent,
          ...(textContent ? { TextPart: textContent } : {}),
          CustomID: `siver-${type || "general"}-${Date.now()}`,
        },
      ],
    };

    const authToken = btoa(`${config.api_key}:${config.api_secret}`);

    const mailjetResponse = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(mailjetPayload),
    });

    const mailjetData = await mailjetResponse.json();

    if (!mailjetResponse.ok) {
      console.error("Mailjet API error:", mailjetData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Mailjet error [${mailjetResponse.status}]: ${mailjetData?.ErrorMessage || JSON.stringify(mailjetData)}`,
        }),
        { status: mailjetResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", { to, subject, type });

    return new Response(
      JSON.stringify({ success: true, data: mailjetData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
