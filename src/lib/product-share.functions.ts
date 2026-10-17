import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type ProductShareMeta = {
  title: string;
  description: string;
  image: string;
};

const isHttpUrl = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//.test(u);

/**
 * Public, read-only lookup of a product's name and best image (selected variant
 * first, then the product's main image) so the server can render link-preview
 * tags for WhatsApp/Facebook/Google. Returns null when nothing is found.
 */
export const getProductShareMeta = createServerFn({ method: "GET" })
  .validator((input: { sku: string }) => ({ sku: String(input.sku ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<ProductShareMeta | null> => {
    const sku = data.sku.trim();
    if (!sku) return null;

    const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    try {
      const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

      const { data: variant } = await sb
        .from("product_variants")
        .select("images, product_id")
        .eq("sku", sku)
        .limit(1)
        .maybeSingle();

      const variantImages = (variant?.images ?? null) as unknown;
      let image = Array.isArray(variantImages) && isHttpUrl(variantImages[0]) ? variantImages[0] : "";
      const productId = (variant?.product_id ?? null) as string | null;

      const productQuery = sb.from("products").select("nombre, descripcion_corta, imagen_principal, galeria_imagenes");
      const { data: product } = productId
        ? await productQuery.eq("id", productId).limit(1).maybeSingle()
        : await productQuery.eq("sku_interno", sku.split("-")[0] ?? sku).limit(1).maybeSingle();

      if (!product && !image) return null;

      const row = (product ?? {}) as {
        nombre?: string | null;
        descripcion_corta?: string | null;
        imagen_principal?: string | null;
        galeria_imagenes?: unknown;
      };
      const gallery = Array.isArray(row.galeria_imagenes) ? row.galeria_imagenes : [];
      if (!image) image = isHttpUrl(row.imagen_principal) ? row.imagen_principal : isHttpUrl(gallery[0]) ? gallery[0] : "";

      return {
        title: row.nombre?.trim() || "Kizkka",
        description: row.descripcion_corta?.trim()?.slice(0, 200) || "Disponible en Kizkka",
        image,
      };
    } catch (error) {
      console.error("getProductShareMeta failed", error);
      return null;
    }
  });
