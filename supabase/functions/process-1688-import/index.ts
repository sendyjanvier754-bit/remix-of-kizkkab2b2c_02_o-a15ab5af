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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { items } = (await req.json()) as { items: ProductRow[] };

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
              content: `You are a product translator for a B2B wholesale platform. Translate Chinese product titles and variants to commercial Spanish. Rules:
- nombre: Traducción fiel y comercial del título original al español. No inventar nombres nuevos ni creativos. Mantener la esencia del producto original.
- variante_color: Traducir colores al español (ej: pink → Rosa; white → Blanco; black → Negro). Si variant1 no es solo un color sino una descripción completa de variante; modelo; acabado o especificación; mantener la descripción completa sin abreviar ni truncar. Si no es un color sino un código de modelo; mantener exactamente igual.
- variante_talla: Mantener tallas y códigos numéricos/alfanuméricos exactamente como están. No traducir ni modificar.
- descripcion: Generar descripción comercial detallada en español basada en el título del producto. Sin límite de caracteres. PROHIBIDO usar comas (,) bajo ninguna circunstancia. Usar puntos; punto y coma o saltos de línea en su lugar.`,
            },
            {
              role: "user",
              content: `Translate these ${items.length} products:\n${itemsList}`,
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
