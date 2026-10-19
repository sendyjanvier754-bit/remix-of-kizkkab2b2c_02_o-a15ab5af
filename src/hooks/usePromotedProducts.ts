import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSponsoredItems, type SponsoredPlacementType } from "@/hooks/useSponsoredPlacements";

export interface PromotedProduct {
  id: string;
  sku: string;
  nombre: string;
  imagen_principal: string;
  precio_b2b: number;
  moq: number;
  stock_fisico: number;
  sponsored?: boolean;
  storeName?: string | null;
}

/**
 * Products for promo strips. Sponsored placements (Kizkka Ads) come first;
 * the rest is filled with official Kizkka catalog products, never from the
 * current category so it does not repeat the grid below.
 */
export const usePromotedProducts = (
  excludeCategoryId: string | null,
  isB2B: boolean,
  placement: SponsoredPlacementType = "category",
  max = 16,
) =>
  useQuery({
    queryKey: ["promoted-products", placement, excludeCategoryId, isB2B, max],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PromotedProduct[]> => {
      const sponsored = await fetchSponsoredItems(placement, excludeCategoryId, isB2B);
      const out: PromotedProduct[] = sponsored.map((s) => ({
        id: s.id, sku: s.sku, nombre: s.nombre, imagen_principal: s.imagen_principal,
        precio_b2b: s.precio_b2b, moq: 1, stock_fisico: 1, sponsored: true, storeName: s.storeName,
      }));
      if (out.length >= max) return out.slice(0, max);

      let q = supabase
        .from("products")
        .select("id, sku_interno, nombre, imagen_principal, precio_mayorista_base, precio_sugerido_venta, moq, stock_fisico, categoria_id")
        .eq("is_active", true)
        .not("imagen_principal", "is", null)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (excludeCategoryId && placement === "category") q = q.neq("categoria_id", excludeCategoryId);
      const { data } = await q;
      const rows = ((data || []) as any[]).filter(
        (p) => p.imagen_principal && p.imagen_principal !== "null" && (p.stock_fisico ?? 1) > 0,
      );
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
      const seen = new Set(out.map((o) => o.sku));
      for (const p of rows) {
        if (out.length >= max) break;
        if (seen.has(p.sku_interno)) continue;
        out.push({
          id: p.id,
          sku: p.sku_interno,
          nombre: p.nombre ?? "",
          imagen_principal: p.imagen_principal,
          precio_b2b: Number((isB2B ? p.precio_mayorista_base : p.precio_sugerido_venta ?? p.precio_mayorista_base) ?? 0),
          moq: p.moq ?? 1,
          stock_fisico: p.stock_fisico ?? 1,
          sponsored: false,
          storeName: "Kizkka",
        });
      }
      return out;
    },
  });
