import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SavedPickupPoint {
  id: string;
  user_id: string;
  pickup_point_id: string;
  department_id: string | null;
  commune_id: string | null;
  label: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  // Datos del pickup_point relacionado (via JOIN)
  pickup_point?: {
    name: string;
    address: string;
    city: string;
    country: string | null;
    phone: string | null;
  };
}

export interface SavedPickupPointInput {
  pickup_point_id: string;
  department_id: string | null;
  commune_id: string | null;
  label?: string;
  is_default?: boolean;
}

export const useSavedPickupPoints = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedPoints = [], isLoading, error } = useQuery({
    queryKey: ['saved-pickup-points', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_saved_pickup_points')
        .select(`
          *,
          pickup_point:pickup_points(name, address, city, country, phone)
        `)
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SavedPickupPoint[];
    },
    enabled: !!user?.id,
  });

  const createSavedPoint = useMutation({
    mutationFn: async (input: SavedPickupPointInput) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      // If this is set as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('user_saved_pickup_points')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }
      
      const { data, error } = await supabase
        .from('user_saved_pickup_points')
        .insert({
          user_id: user.id,
          pickup_point_id: input.pickup_point_id,
          department_id: input.department_id,
          commune_id: input.commune_id,
          label: input.label || 'Mi punto de retiro',
          is_default: input.is_default || false,
        })
        .select()
        .single();
      
      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          throw new Error('Este punto de retiro ya está guardado');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-pickup-points'] });
      toast.success('Punto de retiro guardado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo guardar el punto de retiro');
    },
  });

  const updateSavedPoint = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<SavedPickupPointInput>) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      // If this is set as default, unset other defaults first
      if (updates.is_default) {
        await supabase
          .from('user_saved_pickup_points')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }
      
      const { data, error } = await supabase
        .from('user_saved_pickup_points')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-pickup-points'] });
      toast.success('Punto actualizado');
    },
    onError: () => {
      toast.error('No se pudo actualizar el punto');
    },
  });

  const deleteSavedPoint = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      const { error } = await supabase
        .from('user_saved_pickup_points')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-pickup-points'] });
      toast.success('Punto eliminado');
    },
    onError: () => {
      toast.error('No se pudo eliminar el punto');
    },
  });

  const setDefaultPoint = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      // Unset all defaults first
      await supabase
        .from('user_saved_pickup_points')
        .update({ is_default: false })
        .eq('user_id', user.id);
      
      // Set the new default
      const { error } = await supabase
        .from('user_saved_pickup_points')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-pickup-points'] });
      toast.success('Punto predeterminado actualizado');
    },
    onError: () => {
      toast.error('No se pudo actualizar el punto predeterminado');
    },
  });

  return {
    savedPoints,
    isLoading,
    error,
    createSavedPoint,
    updateSavedPoint,
    deleteSavedPoint,
    setDefaultPoint,
  };
};
