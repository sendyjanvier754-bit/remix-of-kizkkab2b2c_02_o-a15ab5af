import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  type?: "auth" | "marketing" | "communication" | "test" | "orders" | "notifications" | "support" | "authentication";
  // Template-based sending
  template_purpose?: string;
  destination_country_id?: string;
  variables?: Record<string, string>;
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    let { to, subject, htmlContent, textContent, type, template_purpose, destination_country_id, variables } = body;

    if (!to) {
      return new Response(
        JSON.stringify({ success: false, error: "Falta campo requerido: to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If template_purpose is provided, or type is provided without htmlContent, try to load template from DB
    const purpose = template_purpose || type;
    if (purpose && purpose !== "test" && !htmlContent) {
      // Try to find template for specific country first, then fallback to global
      let template = null;
      
      if (destination_country_id) {
        const { data } = await supabaseAdmin
          .from("email_templates")
          .select("*")
          .eq("purpose", purpose)
          .eq("destination_country_id", destination_country_id)
          .eq("is_active", true)
          .limit(1);
        template = data?.[0];
      }

      // Fallback to global template
      if (!template) {
        const { data } = await supabaseAdmin
          .from("email_templates")
          .select("*")
          .eq("purpose", purpose)
          .is("destination_country_id", null)
          .eq("is_active", true)
          .limit(1);
        template = data?.[0];
      }

      if (template) {
        const vars = variables || {};
        subject = replaceVariables(template.subject, vars);
        htmlContent = replaceVariables(template.html_content, vars);
        if (template.text_content) {
          textContent = replaceVariables(template.text_content, vars);
        }
      }
    }

    if (!subject || !htmlContent) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos requeridos: subject, htmlContent (o template no encontrado)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine sender: check email_senders table for type+country-specific sender
    let senderEmail = config.sender_email;
    let senderName = config.sender_name || "Siver";

    if (type && type !== "test") {
      const purposeMap: Record<string, string> = {
        auth: "authentication",
        authentication: "authentication",
        marketing: "marketing",
        communication: "notifications",
        orders: "orders",
        notifications: "notifications",
        support: "support",
      };
      const senderPurpose = purposeMap[type] || type;

      // Try country-specific sender first
      let sender = null;
      if (destination_country_id) {
        const { data: senderData } = await supabaseAdmin
          .from("email_senders")
          .select("sender_email, sender_name, is_active")
          .eq("purpose", senderPurpose)
          .eq("destination_country_id", destination_country_id)
          .eq("is_active", true)
          .limit(1);
        sender = senderData?.[0];
      }

      // Fallback to global sender for this purpose
      if (!sender) {
        const { data: senderData } = await supabaseAdmin
          .from("email_senders")
          .select("sender_email, sender_name, is_active")
          .eq("purpose", senderPurpose)
          .is("destination_country_id", null)
          .eq("is_active", true)
          .limit(1);
        sender = senderData?.[0];
      }

      if (sender && sender.sender_email && sender.sender_email.includes("@")) {
        senderEmail = sender.sender_email;
        senderName = sender.sender_name || senderName;
      }
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
            Email: senderEmail,
            Name: senderName,
          },
          To: recipients,
          Subject: subject,
          HTMLPart: htmlContent,
          ...(textContent ? { TextPart: textContent } : {}),
          CustomID: `siver-${type || "general"}-${Date.now()}`,
        },
      ],
    };

    const authToken = btoa(`${config.api_key.trim()}:${config.api_secret.trim()}`);

    console.log("Sending email via Mailjet:", { to, subject, type, senderEmail, senderName, template_purpose, destination_country_id });

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
