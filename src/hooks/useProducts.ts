import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/types/products";

export const useProducts = (page = 0, limit = 12) => {
  return useQuery({
    queryKey: ["products", page, limit],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .range(page * limit, (page + 1) * limit - 1)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return { products: data as unknown as Product[], total: count || 0 };
    },
  });
};

export const useProductBySku = (sku: string) => {
  return useQuery({
    queryKey: ["product", sku],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("sku_interno", sku)
        .single();

      if (error) throw new Error(error.message);
      return data as unknown as Product;
    },
    enabled: !!sku,
  });
};

export const useProductsByCategory = (categoryId: string | null, page = 0, limit = 12) => {
  return useQuery({
    queryKey: ["products", "category", categoryId, page],
    queryFn: async () => {
      if (!categoryId) return { products: [], total: 0 };

      const { data, error, count } = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("categoria_id", categoryId)
        .eq("is_active", true)
        .range(page * limit, (page + 1) * limit - 1)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return { products: data as unknown as Product[], total: count || 0 };
    },
    enabled: !!categoryId,
  });
};

export const useSearchProducts = (query: string, page = 0, limit = 12) => {
  return useQuery({
    queryKey: ["products", "search", query, page],
    queryFn: async () => {
      if (!query) return { products: [], total: 0 };

      // Search in nombre, descripcion_corta, and descripcion_larga
      const { data, error, count } = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .or(`nombre.ilike.%${query}%,descripcion_corta.ilike.%${query}%,descripcion_larga.ilike.%${query}%`)
        .range(page * limit, (page + 1) * limit - 1);

      if (error) throw new Error(error.message);
      return { products: data as unknown as Product[], total: count || 0 };
    },
    enabled: !!query,
  });
};

export const useInfiniteProducts = (limit = 12) => {
  return useInfiniteQuery({
    queryKey: ["products", "infinite"],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error, count } = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .range(pageParam * limit, (pageParam + 1) * limit - 1)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return {
        products: data as unknown as Product[],
        nextPage: (pageParam + 1) * limit < (count || 0) ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
};
