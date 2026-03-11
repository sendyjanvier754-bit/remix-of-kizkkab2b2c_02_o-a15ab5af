import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PlatformSetting {
  id: string;
  key: string;
  value: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionConfig {
  commission_percentage: number;
  commission_fixed: number;
  tax_tca_percentage: number;
  escrow_release_hours: number;
}

export const usePlatformSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [config, setConfig] = useState<CommissionConfig>({
    commission_percentage: 10,
    commission_fixed: 0.50,
    tax_tca_percentage: 5,
    escrow_release_hours: 48,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('key');

      if (error) throw error;

      setSettings((data || []) as unknown as PlatformSetting[]);
      
      // Parse into config object
      const configMap: Record<string, number> = {};
      (data || []).forEach((s: any) => {
        configMap[s.key] = Number(s.value);
      });

      setConfig({
        commission_percentage: configMap.commission_percentage ?? 10,
        commission_fixed: configMap.commission_fixed ?? 0.50,
        tax_tca_percentage: configMap.tax_tca_percentage ?? 5,
        escrow_release_hours: configMap.escrow_release_hours ?? 48,
      });
    } catch (error: any) {
      console.error('Error fetching platform settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: string, value: number) => {
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value: String(value), updated_at: new Date().toISOString() } as any)
        .eq('key', key);

      if (error) throw error;

      await fetchSettings();
      
      toast({
        title: 'Configuración actualizada',
        description: `${key} actualizado a ${value}`,
      });

      return true;
    } catch (error: any) {
      console.error('Error updating setting:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la configuración',
      });
      return false;
    }
  };

  const updateMultipleSettings = async (updates: Record<string, number>) => {
    try {
      for (const [key, value] of Object.entries(updates)) {
        await supabase
          .from('platform_settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key);
      }

      await fetchSettings();
      
      toast({
        title: 'Configuración actualizada',
        description: 'Todos los valores han sido actualizados',
      });

      return true;
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la configuración',
      });
      return false;
    }
  };

  // Calculate fees for a given amount
  const calculateFees = (saleAmount: number, overrides?: Partial<CommissionConfig>) => {
    const cfg = { ...config, ...overrides };
    const commissionPercent = (saleAmount * cfg.commission_percentage) / 100;
    const commissionTotal = commissionPercent + cfg.commission_fixed;
    const taxAmount = (saleAmount * cfg.tax_tca_percentage) / 100;
    const totalFees = commissionTotal + taxAmount;
    const netAmount = saleAmount - totalFees;

    return {
      saleAmount,
      commissionPercentage: cfg.commission_percentage,
      commissionPercent,
      commissionFixed: cfg.commission_fixed,
      commissionTotal,
      taxPercentage: cfg.tax_tca_percentage,
      taxAmount,
      totalFees,
      netAmount,
    };
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    config,
    isLoading,
    updateSetting,
    updateMultipleSettings,
    calculateFees,
    refetch: fetchSettings,
  };
};
