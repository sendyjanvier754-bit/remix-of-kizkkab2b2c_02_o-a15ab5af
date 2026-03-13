import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface StoreShippingOption {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  shipping_cost: number;
  estimated_days_min: number;
  estimated_days_max: number;
  is_free_above: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateShippingOptionParams {
  store_id: string;
  name: string;
  description?: string;
  shipping_cost: number;
  estimated_days_min: number;
  estimated_days_max: number;
  is_free_above?: number | null;
  is_active?: boolean;
  sort_order?: number;
}

// Hook for sellers to manage their shipping options
export const useStoreShippingOptions = (storeId?: string) => {
  const { user } = useAuth();
  const [options, setOptions] = useState<StoreShippingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOptions = useCallback(async () => {
    if (!storeId) {
      setOptions([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('store_shipping_options')
        .select('*')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setOptions((data || []) as StoreShippingOption[]);
    } catch (err) {
      console.error('Error fetching store shipping options:', err);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const createOption = async (params: CreateShippingOptionParams) => {
    try {
      const { data, error } = await supabase
        .from('store_shipping_options')
        .insert({
          store_id: params.store_id,
          name: params.name,
          description: params.description || null,
          shipping_cost: params.shipping_cost,
          estimated_days_min: params.estimated_days_min,
          estimated_days_max: params.estimated_days_max,
          is_free_above: params.is_free_above || null,
          is_active: params.is_active ?? true,
          sort_order: params.sort_order ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Opción de envío creada');
      await fetchOptions();
      return data as StoreShippingOption;
    } catch (err) {
      console.error('Error creating shipping option:', err);
      toast.error('Error al crear opción de envío');
      throw err;
    }
  };

  const updateOption = async (id: string, updates: Partial<CreateShippingOptionParams>) => {
    try {
      const { error } = await supabase
        .from('store_shipping_options')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Opción de envío actualizada');
      await fetchOptions();
    } catch (err) {
      console.error('Error updating shipping option:', err);
      toast.error('Error al actualizar opción de envío');
      throw err;
    }
  };

  const deleteOption = async (id: string) => {
    try {
      const { error } = await supabase
        .from('store_shipping_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Opción de envío eliminada');
      await fetchOptions();
    } catch (err) {
      console.error('Error deleting shipping option:', err);
      toast.error('Error al eliminar opción de envío');
      throw err;
    }
  };

  return {
    options,
    activeOptions: options.filter(o => o.is_active),
    isLoading,
    createOption,
    updateOption,
    deleteOption,
    refetch: fetchOptions,
  };
};

// Read-only hook for checkout - fetch shipping options for a store
export const useStoreShippingOptionsReadOnly = (storeId?: string) => {
  const [options, setOptions] = useState<StoreShippingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      if (!storeId) {
        setOptions([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('store_shipping_options')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setOptions((data || []) as StoreShippingOption[]);
      } catch (err) {
        console.error('Error fetching store shipping options:', err);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [storeId]);

  return { options, isLoading };
};

/**
 * Fetches active shipping options for multiple stores in a single query.
 * Returns a map keyed by store_id.
 */
export const useMultiStoreShippingOptions = (storeIds: string[]) => {
  const key = storeIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['multi-store-shipping-options', key],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_shipping_options')
        .select('*')
        .in('store_id', storeIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const byStore: Record<string, StoreShippingOption[]> = {};
      for (const option of (data || []) as StoreShippingOption[]) {
        if (!byStore[option.store_id]) byStore[option.store_id] = [];
        byStore[option.store_id].push(option);
      }
      return byStore;
    },
  });
};
