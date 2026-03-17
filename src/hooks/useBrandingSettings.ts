import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BrandingSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useBrandingSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<BrandingSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .order('key');

      if (error) throw error;
      setSettings((data as any[]) || []);
    } catch (error: any) {
      console.error('Error fetching branding settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getValue = (key: string): string => {
    return settings.find(s => s.key === key)?.value || '';
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      const { error } = await supabase
        .from('branding_settings')
        .upsert({ key, value } as any, { onConflict: 'key' });

      if (error) throw error;
      await fetchSettings();
      queryClient.invalidateQueries({ queryKey: ['branding-settings'] });

      toast({
        title: 'Configuración actualizada',
        description: `${key} actualizado correctamente`,
      });
      return true;
    } catch (error: any) {
      console.error('Error updating branding setting:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la configuración',
      });
      return false;
    }
  };

  const updateMultiple = async (updates: Record<string, string>) => {
    try {
      for (const [key, value] of Object.entries(updates)) {
        const { error } = await supabase
          .from('branding_settings')
          .upsert({ key, value } as any, { onConflict: 'key' });
        if (error) throw error;
      }
      await fetchSettings();
      queryClient.invalidateQueries({ queryKey: ['branding-settings'] });
      toast({
        title: 'Identidad actualizada',
        description: 'Todos los valores han sido guardados',
      });
      return true;
    } catch (error: any) {
      console.error('Error updating branding settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error?.message || 'No se pudo actualizar la configuración',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    isLoading,
    getValue,
    updateSetting,
    updateMultiple,
    refetch: fetchSettings,
  };
};
