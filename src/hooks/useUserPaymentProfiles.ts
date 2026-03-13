import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface UserPaymentProfile {
  id: string;
  user_id: string;
  admin_payment_method_id: string;
  method_type: 'bank' | 'moncash' | 'natcash' | 'stripe';
  label: string | null;
  is_default: boolean;
  // Bank fields
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  account_type: string | null;
  bank_swift: string | null;
  // Mobile money fields
  phone_number: string | null;
  holder_name: string | null;
  // Stripe (read-only data from Stripe, never raw card number)
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  card_last4: string | null;
  card_brand: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserPaymentProfileInput {
  admin_payment_method_id: string;
  method_type: 'bank' | 'moncash' | 'natcash' | 'stripe';
  label?: string;
  is_default?: boolean;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  account_type?: string;
  bank_swift?: string;
  phone_number?: string;
  holder_name?: string;
}

export const useUserPaymentProfiles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserPaymentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    if (!user?.id) {
      setProfiles([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_payment_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setProfiles((data || []) as UserPaymentProfile[]);
    } catch (err) {
      console.error('Error fetching user payment profiles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  /** Upsert by admin_payment_method_id (one profile per admin method per user) */
  const saveProfile = async (input: UserPaymentProfileInput): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const existing = profiles.find(p => p.admin_payment_method_id === input.admin_payment_method_id);

      // If setting this as default, un-default the others
      if (input.is_default) {
        await supabase
          .from('user_payment_profiles')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('admin_payment_method_id', input.admin_payment_method_id);
      }

      const payload = {
        user_id: user.id,
        admin_payment_method_id: input.admin_payment_method_id,
        method_type: input.method_type,
        label: input.label ?? null,
        is_default: input.is_default ?? false,
        bank_name: input.bank_name ?? null,
        account_number: input.account_number ?? null,
        account_holder: input.account_holder ?? null,
        account_type: input.account_type ?? null,
        bank_swift: input.bank_swift ?? null,
        phone_number: input.phone_number ?? null,
        holder_name: input.holder_name ?? null,
      };

      if (existing) {
        const { error } = await supabase
          .from('user_payment_profiles')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_payment_profiles')
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Guardado', description: 'Tu método de pago fue guardado.' });
      await fetchProfiles();
      return true;
    } catch (err) {
      console.error('Error saving user payment profile:', err);
      toast({ title: 'Error', description: 'No se pudo guardar el método de pago.', variant: 'destructive' });
      return false;
    }
  };

  const deleteProfile = async (profileId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('user_payment_profiles')
        .delete()
        .eq('id', profileId);
      if (error) throw error;
      toast({ title: 'Eliminado', description: 'Método de pago eliminado.' });
      await fetchProfiles();
      return true;
    } catch (err) {
      console.error('Error deleting user payment profile:', err);
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
      return false;
    }
  };

  const getProfileByMethodId = (adminMethodId: string) =>
    profiles.find(p => p.admin_payment_method_id === adminMethodId);

  return {
    profiles,
    isLoading,
    saveProfile,
    deleteProfile,
    getProfileByMethodId,
    refetch: fetchProfiles,
    defaultProfile: profiles.find(p => p.is_default) ?? profiles[0] ?? null,
  };
};
