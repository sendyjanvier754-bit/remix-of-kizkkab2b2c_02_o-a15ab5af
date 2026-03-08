import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppNotificationRequest {
  notificationId?: string;
  phone: string;
  message: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authorization: require admin or seller role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isSeller } = await serviceClient.rpc("has_role", { _user_id: userId, _role: "seller" });

    if (!isAdmin && !isSeller) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    // --- End authorization ---

    const {
      notificationId,
      phone,
      message,
      templateName,
      templateParams,
    }: WhatsAppNotificationRequest = await req.json();

    // Validate required fields
    if (!phone || !message) {
      throw new Error("Missing required fields: phone, message");
    }

    // Get WhatsApp API credentials from secrets
    const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_ID");
    
    if (!whatsappApiKey || !whatsappPhoneId) {
      console.log("WhatsApp not configured - logging message instead");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "WhatsApp not configured - message logged",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = phone.replace(/[+\s-]/g, '');

    // Build WhatsApp API request
    const whatsappPayload = templateName
      ? {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "es" },
            components: templateParams
              ? [
                  {
                    type: "body",
                    parameters: Object.entries(templateParams).map(([_, value]) => ({
                      type: "text",
                      text: value,
                    })),
                  },
                ]
              : undefined,
          },
        }
      : {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        };

    // Send via WhatsApp Business API
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(whatsappPayload),
      }
    );

    const whatsappResult = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      throw new Error(`WhatsApp API error: ${JSON.stringify(whatsappResult)}`);
    }

    console.log("WhatsApp message sent:", whatsappResult);

    // Update notification if ID provided
    if (notificationId) {
      await serviceClient
        .from("notifications")
        .update({ is_whatsapp_sent: true })
        .eq("id", notificationId);
    }

    return new Response(
      JSON.stringify({ success: true, data: whatsappResult }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending WhatsApp notification:", error);
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
