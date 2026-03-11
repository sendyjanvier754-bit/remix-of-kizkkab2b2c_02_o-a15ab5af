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

export const useSellerProductsByCategory = (categoryId: string | undefined, limit = 20) => {
  return useQuery({
    queryKey: ["seller-products-category", categoryId, limit],
    queryFn: async () => {
      if (!categoryId) return [];

      // First get products with this category from products table
      const { data: productIds, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("categoria_id", categoryId)
        .eq("is_active", true);

      if (productError || !productIds?.length) {
        return [];
      }

      const ids = productIds.map(p => p.id);

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
        .in("source_product_id", ids)
        .limit(limit)
        .order("imported_at", { ascending: false });

      if (error) {
        console.error("Error fetching products by category:", error);
        return [];
      }

      return data as unknown as SellerProduct[];
    },
    enabled: !!categoryId,
  });
};
