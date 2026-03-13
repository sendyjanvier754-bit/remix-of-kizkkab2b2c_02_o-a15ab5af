import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string | null;
  street_address: string;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  notes: string | null;
  department_id: string | null;
  commune_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AddressInput = Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export const useAddresses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading, error } = useQuery({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Address[];
    },
    enabled: !!user?.id,
  });

  const createAddress = useMutation({
    mutationFn: async (input: AddressInput) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      // If this is set as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }
      
      const { data, error } = await supabase
        .from('addresses')
        .insert({
          city: input.city,
          country: input.country,
          full_name: input.full_name,
          label: input.label,
          street_address: input.street_address,
          phone: input.phone ?? null,
          state: input.state ?? null,
          postal_code: input.postal_code ?? null,
          is_default: input.is_default,
          notes: input.notes ?? null,
          department_id: input.department_id ?? null,
          commune_id: input.commune_id ?? null,
          destination_country_id: (input as any).destination_country_id ?? null,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast({
        title: 'Dirección creada',
        description: 'La dirección se ha guardado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateAddress = useMutation({
    mutationFn: async ({ id, ...input }: Partial<AddressInput> & { id: string }) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      // If this is set as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }
      
      const { data, error } = await supabase
        .from('addresses')
        .update(input)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast({
        title: 'Dirección actualizada',
        description: 'Los cambios se han guardado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast({
        title: 'Dirección eliminada',
        description: 'La dirección se ha eliminado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const setDefaultAddress = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      // Unset all defaults first
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
      
      // Set the new default
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast({
        title: 'Dirección predeterminada',
        description: 'Se ha establecido como dirección predeterminada.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    addresses,
    isLoading,
    error,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };
};
