import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SellerProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  precio_costo: number;
  stock: number;
  images: any;
  is_active: boolean;
  seller_store_id: string;
  source_product_id: string | null;
  metadata: any;
  store: {
    id: string;
    name: string;
    logo: string | null;
    whatsapp: string | null;
    is_active: boolean;
  } | null;
  source_product: {
    id: string;
    categoria_id: string | null;
    precio_mayorista: number;
    precio_sugerido_venta: number | null;
    moq: number;
    stock_fisico: number;
    category: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
}

export const useSellerProduct = (sku: string | undefined) => {
  return useQuery({
    queryKey: ["seller-product", sku],
    queryFn: async () => {
      if (!sku) return null;

      const { data, error } = await supabase
        .from("seller_catalog")
        .select(`
          *,
          store:stores!seller_catalog_seller_store_id_fkey(
            id,
            name,
            logo,
            whatsapp,
            is_active
          ),
          source_product:products!seller_catalog_source_product_id_fkey(
            id,
            categoria_id,
            precio_mayorista_base,
            precio_sugerido_venta,
            moq,
            stock_fisico,
            category:categories!products_categoria_id_fkey(
              id,
              name,
              slug
            )
          )
        `)
        .eq("sku", sku)
        .eq("is_active", true)
        .single();

      if (error) {
        console.error("Error fetching product:", error);
        return null;
      }

      return data as unknown as SellerProduct;
    },
    enabled: !!sku,
  });
};

export const useSellerProducts = (limit = 20) => {
  return useQuery({
    queryKey: ["seller-products", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
         .from("seller_catalog")
         .select(`
           *,
           store:stores!seller_catalog_seller_store_id_fkey(
             id,
             name,
             logo,
             whatsapp,
             is_active
           ),
           source_product:products!seller_catalog_source_product_id_fkey(
             id,
             categoria_id,
             precio_mayorista,
             precio_sugerido_venta,
             moq,
             stock_fisico,
             category:categories!products_categoria_id_fkey(
               id,
               name,
               slug
             )
           )
         `)
         .eq("is_active", true)
         .limit(limit)
         .order("imported_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
        return [];
      }

      return data as unknown as SellerProduct[];
    },
  });
};

export const useSellerProductsByCategory = (categoryId: string | undefined, allCategories: { id: string; parent_id: string | null }[] = [], limit = 50) => {
  return useQuery({
    queryKey: ["seller-products-category", categoryId, limit],
    queryFn: async () => {
      if (!categoryId) return [];

      // Collect category + all descendant category IDs
      const collectDescendants = (parentId: string): string[] => {
        const children = allCategories.filter(c => c.parent_id === parentId);
        return children.reduce<string[]>((acc, child) => [...acc, child.id, ...collectDescendants(child.id)], []);
      };
      const categoryIds = [categoryId, ...collectDescendants(categoryId)];

      // Query seller_catalog directly by category_id OR via source_product category
      // Strategy: get products from products table with matching categories, then find their seller_catalog entries
      const { data: productIds, error: productError } = await supabase
        .from("products")
        .select("id")
        .in("categoria_id", categoryIds)
        .eq("is_active", true);

      if (productError) {
        console.error("Error fetching product IDs by category:", productError);
        return [];
      }

      const sourceIds = (productIds || []).map(p => p.id);

      // Also query seller_catalog entries that have category_id directly set
      // Build OR filter: category_id in categoryIds OR source_product_id in sourceIds
      let query = supabase
        .from("seller_catalog")
        .select(`
          *,
          store:stores!seller_catalog_seller_store_id_fkey(
            id,
            name,
            logo,
            whatsapp,
            is_active
          ),
          source_product:products!seller_catalog_source_product_id_fkey(
            id,
            categoria_id,
            precio_mayorista,
            precio_sugerido_venta,
            moq,
            stock_fisico,
            category:categories!products_categoria_id_fkey(
              id,
              name,
              slug
            )
          )
        `)
        .eq("is_active", true)
        .limit(limit)
        .order("imported_at", { ascending: false });

      // Build filter: match by direct category_id OR by source_product_id
      if (sourceIds.length > 0) {
        query = query.or(`category_id.in.(${categoryIds.join(',')}),source_product_id.in.(${sourceIds.join(',')})`);
      } else {
        query = query.in("category_id", categoryIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching seller products by category:", error);
        return [];
      }

      // Deduplicate by source_product_id (keep first/newest per product)
      const seen = new Set<string>();
      const deduped = (data as unknown as SellerProduct[]).filter(item => {
        const key = item.source_product_id || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduped;
    },
    enabled: !!categoryId,
  });
};
