import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductVariant } from "./useProductVariants";

export interface CreateVariantData {
  product_id: string;
  sku: string;
  name: string;
  option_type: string;
  option_value: string;
  price?: number | null;
  precio_promocional?: number | null;
  stock: number;
  moq?: number;
  images?: string[];
  sort_order?: number;
}

export interface UpdateVariantData {
  id: string;
  updates: Partial<Omit<ProductVariant, 'id' | 'product_id'>>;
}

export const useVariantManagement = (productId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createVariant = useMutation({
    mutationFn: async (data: CreateVariantData) => {
      const { data: variant, error } = await supabase
        .from("product_variants")
        .insert({
          product_id: data.product_id,
          sku: data.sku,
          name: data.name,
          option_type: data.option_type,
          option_value: data.option_value,
          price: data.price ?? null,
          precio_promocional: data.precio_promocional ?? null,
          stock: data.stock,
          moq: data.moq ?? 1,
          images: data.images ?? [],
          sort_order: data.sort_order ?? 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return variant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-variants", productId] });
      toast({ title: "Variante creada exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear variante", description: error.message, variant: "destructive" });
    },
  });

  const updateVariant = useMutation({
    mutationFn: async ({ id, updates }: UpdateVariantData) => {
      const { data: variant, error } = await supabase
        .from("product_variants")
        .update({
          ...(updates as Database["public"]["Tables"]["product_variants"]["Update"]),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return variant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-variants", productId] });
      toast({ title: "Variante actualizada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar variante", description: error.message, variant: "destructive" });
    },
  });

  const deleteVariant = useMutation({
    mutationFn: async (variantId: string) => {
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", variantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-variants", productId] });
      toast({ title: "Variante eliminada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar variante", description: error.message, variant: "destructive" });
    },
  });

  const toggleVariantActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("product_variants")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-variants", productId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar estado", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpdateStock = useMutation({
    mutationFn: async (updates: { id: string; stock: number }[]) => {
      const promises = updates.map(({ id, stock }) =>
        supabase
          .from("product_variants")
          .update({ stock, updated_at: new Date().toISOString() })
          .eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-variants", productId] });
      toast({ title: "Stock actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar stock", description: error.message, variant: "destructive" });
    },
  });

  return {
    createVariant,
    updateVariant,
    deleteVariant,
    toggleVariantActive,
    bulkUpdateStock,
  };
};
