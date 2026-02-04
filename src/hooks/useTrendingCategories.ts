import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrendingCategoryProduct {
  id: string;
  sku: string;
  nombre: string;
  imagen: string | null;
  precio: number;
}

export interface TrendingCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  productCount: number;
  products: TrendingCategoryProduct[];
}

export const useTrendingCategories = (limit = 6) => {
  return useQuery({
    queryKey: ["trending-categories", limit],
    queryFn: async () => {
      // Get visible root categories
      const { data: categories, error: catError } = await supabase
        .from("categories")
        .select("id, name, slug, icon, description")
        .is("parent_id", null)
        .eq("is_visible_public", true)
        .order("sort_order", { ascending: true })
        .limit(limit);

      if (catError) throw catError;
      if (!categories || categories.length === 0) return [];

      // For each category, get product count and 4 sample products
      const categoriesWithProducts: TrendingCategory[] = await Promise.all(
        categories.map(async (cat) => {
          // Get products in this category
          const { data: products, error: prodError } = await supabase
            .from("v_productos_con_precio_b2b")
            .select("id, sku_interno, nombre, imagen_principal, precio_sugerido_venta, precio_b2b")
            .eq("categoria_id", cat.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(4);

          if (prodError) {
            console.error("Error fetching products for category:", prodError);
          }

          // Get total count
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("categoria_id", cat.id)
            .eq("is_active", true);

          return {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            description: cat.description,
            productCount: count || 0,
            products: (products || []).map((p) => ({
              id: p.id,
              sku: p.sku_interno,
              nombre: p.nombre,
              imagen: p.imagen_principal,
              precio: p.precio_sugerido_venta || p.precio_b2b,
            })),
          };
        })
      );

      // Sort by product count (most products first) and filter out empty ones
      return categoriesWithProducts
        .filter((c) => c.productCount > 0)
        .sort((a, b) => b.productCount - a.productCount);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
