import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@3.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  notificationId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  title: string;
  message: string;
  ctaUrl?: string;
  ctaText?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller identity and require admin or seller role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Only admins and sellers can send notification emails
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: isSeller } = await serviceClient.rpc('has_role', { _user_id: userId, _role: 'seller' });
    if (!isAdmin && !isSeller) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin or seller role required' }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const {
      notificationId,
      recipientEmail,
      recipientName,
      subject,
      title,
      message,
      ctaUrl,
      ctaText,
    }: NotificationEmailRequest = await req.json();

    // Validate required fields
    if (!recipientEmail || !subject || !title || !message) {
      throw new Error("Missing required fields: recipientEmail, subject, title, message");
    }

    // HTML-escape helper to prevent injection
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g, '&#39;');

    // Validate ctaUrl if provided
    const safeCtaUrl = ctaUrl && /^https?:\/\//i.test(ctaUrl) ? esc(ctaUrl) : null;

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #071d7f 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; color: #111827; }
    .message { color: #4b5563; margin-bottom: 20px; }
    .cta { display: inline-block; background: #071d7f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Silver Market Haiti</h1>
    </div>
    <div class="content">
      <p class="title">${esc(title)}</p>
      <p class="message">${esc(message)}</p>
      ${safeCtaUrl ? `<p><a href="${safeCtaUrl}" class="cta">${esc(ctaText || 'Ver más')}</a></p>` : ''}
    </div>
    <div class="footer">
      <p>Este es un mensaje automático de Silver Market Haiti.</p>
      <p>© ${new Date().getFullYear()} Silver Market Haiti. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Silver Market <notifications@resend.dev>",
      to: [recipientEmail],
      subject: subject,
      html: emailHtml,
    });

    console.log("Email sent:", emailResponse);

    // Update notification if ID provided
    if (notificationId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("notifications")
        .update({ is_email_sent: true })
        .eq("id", notificationId);
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
