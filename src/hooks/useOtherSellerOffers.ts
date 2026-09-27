/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SellerOffer {
  catalogId: string;
  sku: string;
  price: number;
  stock: number;
  image: string | null;
  storeId: string | null;
  storeName: string;
  storeLogo: string | null;
  storeSlug: string | null;
  isCurrent: boolean;
}

const firstImage = (images: any): string | null => {
  if (Array.isArray(images)) return images.find((i) => typeof i === "string" && i.trim()) || null;
  if (typeof images === "string" && images.trim()) {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed[0] ?? null : images;
    } catch {
      return images;
    }
  }
  return null;
};

/**
 * Lista todas las tiendas que venden el mismo producto base,
 * ordenadas por el mejor precio (estilo "otras opciones de compra").
 */
export const useOtherSellerOffers = (
  sourceProductId: string | null | undefined,
  currentCatalogId: string | null | undefined
) => {
  return useQuery({
    queryKey: ["other-seller-offers", sourceProductId, currentCatalogId],
    queryFn: async (): Promise<SellerOffer[]> => {
      const { data, error } = await (supabase as any)
        .from("seller_catalog")
        .select(`
          id, sku, nombre, precio_venta, stock, images, seller_store_id,
          store:stores!seller_catalog_seller_store_id_fkey(id, name, logo, slug)
        `)
        .eq("source_product_id", sourceProductId)
        .eq("is_active", true)
        .gt("stock", 0)
        .order("precio_venta", { ascending: true })
        .limit(30);

      if (error) throw error;

      const seen = new Set<string>();
      const offers: SellerOffer[] = [];

      for (const item of (data || []) as any[]) {
        const storeId = item.store?.id || item.seller_store_id || null;
        const key = storeId || item.id;
        if (seen.has(key)) continue;
        seen.add(key);

        offers.push({
          catalogId: item.id,
          sku: item.sku,
          price: Number(item.precio_venta) || 0,
          stock: Number(item.stock) || 0,
          image: firstImage(item.images),
          storeId,
          storeName: item.store?.name || "",
          storeLogo: item.store?.logo || null,
          storeSlug: item.store?.slug || null,
          isCurrent: item.id === currentCatalogId,
        });
      }

      return offers;
    },
    enabled: !!sourceProductId,
    staleTime: 2 * 60 * 1000,
  });
};
