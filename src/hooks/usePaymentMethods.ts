import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PaymentMethod {
  id: string;
  owner_type: 'admin' | 'seller' | 'store';
  owner_id: string | null;
  method_type: 'bank' | 'moncash' | 'natcash' | 'stripe';
  is_active: boolean;
  display_name: string | null;
  // Country where this payment account is registered (bank country / mobile wallet country)
  // NOT the shipping destination — this is the account's own country
  destination_country_id: string | null;
  // Dual mode support - admin can enable both modes
  manual_enabled: boolean;
  automatic_enabled: boolean;
  // Bank fields
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  bank_swift: string | null;
  // Mobile money fields
  phone_number: string | null;
  holder_name: string | null;
  // Metadata for API credentials when automatic_enabled = true
  // For MonCash: { client_id, client_secret, business_key }
  // For NatCash: { api_key, api_secret }
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodInput {
  method_type: 'bank' | 'moncash' | 'natcash' | 'stripe';
  is_active?: boolean;
  display_name?: string;
  // Country where this account is registered (e.g. Haiti for MonCash, US for a USD bank account)
  destination_country_id?: string | null;
  manual_enabled?: boolean;
  automatic_enabled?: boolean;
  bank_name?: string;
  account_type?: string;
  account_number?: string;
  account_holder?: string;
  bank_swift?: string;
  phone_number?: string;
  holder_name?: string;
  metadata?: Record<string, unknown>;
}

export const usePaymentMethods = (ownerType: 'admin' | 'seller' | 'store', ownerId?: string, countryId?: string | null) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMethods = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('payment_methods')
        .select('*')
        .eq('owner_type', ownerType);

      if (ownerType !== 'admin' && ownerId) {
        query = query.eq('owner_id', ownerId);
      } else if (ownerType === 'admin') {
        query = query.is('owner_id', null);
      }

      // Filter by country if provided
      if (countryId !== undefined) {
        if (countryId) {
          query = query.eq('destination_country_id', countryId);
        } else {
          query = query.is('destination_country_id', null);
        }
      }

      const { data, error: fetchError } = await query.order('method_type');

      if (fetchError) throw fetchError;
      setMethods((data || []) as PaymentMethod[]);
    } catch (err) {
      console.error('Error fetching payment methods:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar métodos de pago');
    } finally {
      setIsLoading(false);
    }
  }, [ownerType, ownerId, countryId]);

  const upsertMethod = async (input: PaymentMethodInput): Promise<boolean> => {
    try {
      // Find existing method matching on type AND country
      const resolvedCountryId = input.destination_country_id !== undefined ? input.destination_country_id : (countryId ?? null);
      const existing = methods.find(m =>
        m.method_type === input.method_type &&
        (m.destination_country_id ?? null) === (resolvedCountryId ?? null)
      );

      // Cast metadata to Json type for Supabase compatibility
      const data = {
        owner_type: ownerType,
        owner_id: ownerType === 'admin' ? null : ownerId,
        method_type: input.method_type,
        name: input.display_name ?? input.method_type, // 'name' is required by DB
        is_active: input.is_active,
        display_name: input.display_name,
        destination_country_id: resolvedCountryId,
        manual_enabled: input.manual_enabled,
        automatic_enabled: input.automatic_enabled,
        bank_name: input.bank_name,
        account_type: input.account_type,
        account_number: input.account_number,
        account_holder: input.account_holder,
        bank_swift: input.bank_swift,
        phone_number: input.phone_number,
        holder_name: input.holder_name,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      };

      if (existing) {
        const { error: updateError } = await supabase
          .from('payment_methods')
          .update(data)
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('payment_methods')
          .insert(data);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Guardado',
        description: `Método de pago ${input.method_type} guardado correctamente`,
      });

      await fetchMethods();
      return true;
    } catch (err) {
      console.error('Error saving payment method:', err);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el método de pago',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteMethod = async (methodId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', methodId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Eliminado',
        description: 'Método de pago eliminado correctamente',
      });

      await fetchMethods();
      return true;
    } catch (err) {
      console.error('Error deleting payment method:', err);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el método de pago',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleActive = async (methodId: string, isActive: boolean): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('payment_methods')
        .update({ is_active: isActive })
        .eq('id', methodId);

      if (updateError) throw updateError;

      await fetchMethods();
      return true;
    } catch (err) {
      console.error('Error toggling payment method:', err);
      return false;
    }
  };

  // Helper to get method by type (filtered by current country if set)
  const getMethodByType = (type: 'bank' | 'moncash' | 'natcash' | 'stripe'): PaymentMethod | undefined => {
    return methods.find(m => m.method_type === type);
  };

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  return {
    methods,
    isLoading,
    error,
    refetch: fetchMethods,
    upsertMethod,
    deleteMethod,
    toggleActive,
    getMethodByType,
    // Convenience getters
    bankMethod: getMethodByType('bank'),
    moncashMethod: getMethodByType('moncash'),
    natcashMethod: getMethodByType('natcash'),
    stripeMethod: getMethodByType('stripe'),
  };
};

// Hook specifically for getting admin payment methods (for B2B sellers)
export const useAdminPaymentMethods = () => {
  return usePaymentMethods('admin');
};

// Hook for getting store payment methods (for B2C customers)
export const useStorePaymentMethods = (storeId?: string) => {
  return usePaymentMethods('store', storeId);
};

// Hook to fetch payment methods for a specific store (read-only, for checkout)
export const useStorePaymentMethodsReadOnly = (storeId?: string) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMethods = async () => {
      if (!storeId) {
        setMethods([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('owner_type', 'store')
          .eq('owner_id', storeId)
          .eq('is_active', true);

        if (error) throw error;
        setMethods((data || []) as PaymentMethod[]);
      } catch (err) {
        console.error('Error fetching store payment methods:', err);
        setMethods([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMethods();
  }, [storeId]);

  return {
    methods,
    isLoading,
    bankMethod: methods.find(m => m.method_type === 'bank'),
    moncashMethod: methods.find(m => m.method_type === 'moncash'),
    natcashMethod: methods.find(m => m.method_type === 'natcash'),
  };
};

// Hook to fetch admin payment methods for checkout (read-only)
export const useAdminPaymentMethodsReadOnly = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const { data, error } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('owner_type', 'admin')
          .is('owner_id', null)
          .eq('is_active', true);

        if (error) throw error;
        setMethods((data || []) as PaymentMethod[]);
      } catch (err) {
        console.error('Error fetching admin payment methods:', err);
        setMethods([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMethods();
  }, []);

  return {
    methods,
    isLoading,
    bankMethod: methods.find(m => m.method_type === 'bank'),
    moncashMethod: methods.find(m => m.method_type === 'moncash'),
    natcashMethod: methods.find(m => m.method_type === 'natcash'),
  };
};