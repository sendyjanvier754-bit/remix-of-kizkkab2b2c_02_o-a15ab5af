import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Branding defaults — used as fallback when the DB has no value.
 * These are the only hardcoded strings; everything else reads from `branding_settings`.
 */
const DEFAULTS: Record<string, string> = {
  platform_name: 'Siver Market',
  platform_slogan: 'Tu marketplace de confianza',
  logo_url: '',
  favicon_url: '',
  meta_title: '',
  meta_description: '',
};

/**
 * Lightweight branding hook backed by React Query.
 * The result is cached globally — the DB is queried only once per 5 minutes no
 * matter how many components call this hook simultaneously.
 */
export const useBranding = () => {
  const { data: settings = [] } = useQuery({
    queryKey: ['branding-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('branding_settings')
        .select('key, value');
      return (data as { key: string; value: string }[]) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getValue = (key: string): string => {
    const found = settings.find((s) => s.key === key);
    return found?.value || DEFAULTS[key] || '';
  };

  return { getValue };
};
