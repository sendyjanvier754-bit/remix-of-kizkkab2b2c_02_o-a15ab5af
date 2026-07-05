import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductRow {
  title: string;
  variant1?: string;
  variant2?: string;
}

const LANG_NAMES: Record<string, string> = {
  es: "Spanish (español)",
  en: "English",
  fr: "French (français)",
  ht: "Haitian Creole (kreyòl ayisyen)",
  pt: "Portuguese (português)",
  zh: "Simplified Chinese (简体中文)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body = await req.json();
    const items: ProductRow[] = body?.items ?? [];
    const language: string = (body?.language ?? "es").toLowerCase();
    const langName = LANG_NAMES[language] ?? language;

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt with all items
    const itemsList = items
      .map(
        (item, i) =>
          `${i + 1}. title: "${item.title}"${item.variant1 ? ` | variant1: "${item.variant1}"` : ""}${item.variant2 ? ` | variant2: "${item.variant2}"` : ""}`
      )
      .join("\n");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a product translator for a B2B wholesale platform. Translate Chinese product titles and variants into ${langName}. Rules:
- nombre: Faithful commercial translation of the original title into ${langName}. Do not invent new or creative names. Keep the essence of the original product.
- variante_color: Translate ONLY into ${langName} (e.g. pink -> Rosa/Pink/Rose/Woz depending on target). NEVER include the original text in parentheses or another language. If variant1 contains color + number/size at the end (e.g. "钻石银 36") and variant2 exists with that size; return ONLY the descriptive part without the number. If variant1 is a full description of variant/model/finish; keep it complete but without trailing size numbers. If it is a model code; keep it exactly as-is.
- variante_talla: Keep sizes and numeric/alphanumeric codes exactly as they are. Do not translate or modify.
- descripcion: Generate a detailed commercial description in ${langName} based on the product title. No character limit. FORBIDDEN to use commas (,) under any circumstance. Use periods; semicolons or line breaks instead.`,
            },
            {
              role: "user",
              content: `Translate these ${items.length} products into ${langName}:\n${itemsList}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translations",
                description:
                  "Return translated product data for all items",
                parameters: {
                  type: "object",
                  properties: {
                    translations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "number" },
                          nombre: { type: "string" },
                          variante_color: { type: "string" },
                          variante_talla: { type: "string" },
                          descripcion: { type: "string" },
                        },
                        required: [
                          "index",
                          "nombre",
                          "variante_color",
                          "variante_talla",
                          "descripcion",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["translations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_translations" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let translations = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      translations = parsed.translations || [];
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-1688-import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
