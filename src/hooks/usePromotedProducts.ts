import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromotedProduct {
  id: string;
  sku: string;
  nombre: string;
  imagen_principal: string;
  precio_b2b: number;
  moq: number;
  stock_fisico: number;
}

/**
 * Products for the top promo strip on category pages.
 * Never repeats the current category. Until sponsored placements exist,
 * falls back to official Kizkka catalog products from other categories.
 */
export const usePromotedProducts = (excludeCategoryId: string | null, isB2B: boolean) =>
  useQuery({
    queryKey: ["promoted-products", excludeCategoryId, isB2B],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PromotedProduct[]> => {
      let q = supabase
        .from("products")
        .select("id, sku_interno, nombre, imagen_principal, precio_mayorista_base, precio_sugerido_venta, moq, stock_fisico, categoria_id")
        .eq("is_active", true)
        .not("imagen_principal", "is", null)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (excludeCategoryId) q = q.neq("categoria_id", excludeCategoryId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = ((data || []) as any[]).filter(
        (p) => p.imagen_principal && p.imagen_principal !== "null" && (p.stock_fisico ?? 1) > 0,
      );
      // Light shuffle so the strip varies between visits
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
      return rows.slice(0, 16).map((p) => ({
        id: p.id,
        sku: p.sku_interno,
        nombre: p.nombre ?? "",
        imagen_principal: p.imagen_principal,
        precio_b2b: Number((isB2B ? p.precio_mayorista_base : p.precio_sugerido_venta ?? p.precio_mayorista_base) ?? 0),
        moq: p.moq ?? 1,
        stock_fisico: p.stock_fisico ?? 1,
      }));
    },
  });
