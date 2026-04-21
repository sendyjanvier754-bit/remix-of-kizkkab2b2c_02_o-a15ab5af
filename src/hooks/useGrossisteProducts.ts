import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface GrossisteProduct {
  id: string;
  sku_interno: string;
  nombre: string;
  descripcion_corta: string | null;
  costo_base_excel: number | null;
  precio_mayorista_base: number | null;
  stock_fisico: number | null;
  imagen_principal: string | null;
  is_active: boolean;
  approval_status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  approval_notes: string | null;
  created_at: string;
}

export function useGrossisteProducts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['grossiste-products', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const query: any = supabase.from('products');
      const { data, error } = await query
        .select('id, sku_interno, nombre, descripcion_corta, costo_base_excel, precio_mayorista_base, stock_fisico, imagen_principal, is_active, approval_status, approval_notes, created_at')
        .eq('owner_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GrossisteProduct[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: {
      sku_interno: string;
      nombre: string;
      descripcion_corta?: string;
      costo_base_excel: number;
      precio_mayorista_base: number;
      stock_fisico?: number;
      imagen_principal?: string;
    }) => {
      const { error } = await supabase.from('products').insert({
        ...input,
        owner_user_id: user!.id,
        owner_role: 'grossiste',
        approval_status: 'pending_review',
        is_active: true,
        moq: 1,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grossiste-products'] });
      toast.success("Producto enviado a revisión");
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<GrossisteProduct> }) => {
      const { error } = await supabase.from('products').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grossiste-products'] });
      toast.success("Producto actualizado");
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grossiste-products'] });
      toast.success("Producto eliminado");
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  return { products, isLoading, create, update, remove };
}
