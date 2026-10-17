import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!slug) throw new Error("Category slug is required");
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hora
  });
};

export const useCategoryBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      if (!slug) throw new Error("Category slug is required");
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 60,
  });
};
