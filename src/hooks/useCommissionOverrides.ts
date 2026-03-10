import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CommissionOverride {
  id: string;
  seller_id: string;
  commission_percentage: number | null;
  commission_fixed: number | null;
  tax_tca_percentage: number | null;
  reason: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  seller_name?: string;
}

export const useCommissionOverrides = () => {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<CommissionOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverrides = async () => {
    try {
      setIsLoading(true);
      
      // Fetch overrides
      const { data, error } = await supabase
        .from('seller_commission_overrides')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch seller names separately
      const overridesWithNames = await Promise.all(
        (data || []).map(async (override: any) => {
          const { data: sellerData } = await supabase
            .from('sellers')
            .select('name, business_name')
            .eq('id', override.seller_id)
            .maybeSingle();

          const sellerData = sellerResult as any;
            ...override,
            seller_name: sellerData?.business_name || sellerData?.name,
          };
        })
      );

      setOverrides(overridesWithNames);
    } catch (error: any) {
      console.error('Error fetching overrides:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createOverride = async (
    sellerId: string,
    override: {
      commission_percentage?: number;
      commission_fixed?: number;
      tax_tca_percentage?: number;
      reason?: string;
    }
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('seller_commission_overrides')
        .upsert({
          seller_id: sellerId,
          ...override,
          is_active: true,
          created_by: user?.id,
        }, {
          onConflict: 'seller_id',
        });

      if (error) throw error;

      toast({
        title: 'Override creado',
        description: 'Comisión personalizada guardada',
      });

      await fetchOverrides();
      return true;
    } catch (error: any) {
      console.error('Error creating override:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear el override',
      });
      return false;
    }
  };

  const updateOverride = async (id: string, updates: Partial<CommissionOverride>) => {
    try {
      const { error } = await supabase
        .from('seller_commission_overrides')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Override actualizado',
      });

      await fetchOverrides();
      return true;
    } catch (error: any) {
      console.error('Error updating override:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el override',
      });
      return false;
    }
  };

  const deleteOverride = async (id: string) => {
    try {
      const { error } = await supabase
        .from('seller_commission_overrides')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Override eliminado',
      });

      await fetchOverrides();
      return true;
    } catch (error: any) {
      console.error('Error deleting override:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el override',
      });
      return false;
    }
  };

  const getOverrideForSeller = (sellerId: string) => {
    return overrides.find(o => o.seller_id === sellerId && o.is_active);
  };

  useEffect(() => {
    fetchOverrides();
  }, []);

  return {
    overrides,
    isLoading,
    createOverride,
    updateOverride,
    deleteOverride,
    getOverrideForSeller,
    refetch: fetchOverrides,
  };
};
