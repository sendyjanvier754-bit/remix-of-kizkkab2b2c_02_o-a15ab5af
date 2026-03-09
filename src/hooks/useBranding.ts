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
  // Payment method icon defaults — point to the existing static files
  payment_icon_visa: '/visa.png',
  payment_icon_mastercard: '/mastercard.png',
  payment_icon_amex: '/american express.png',
  payment_icon_applepay: '/apple pay.png',
  payment_icon_googlepay: '/google pay.png',
  payment_icon_moncash: '',
  payment_icon_natcash: '',
  payment_icon_transfer: '',
  // Legal page content — empty means use hardcoded default
  legal_terms: '',
  legal_privacy: '',
  legal_cookies: '',
  // About & affiliate program content — empty means use hardcoded default
  about_content: '',
  affiliate_program: '',
  // Trust/guarantee badges shown in footer
  trust_badge_1_title: 'Envío desde el extranjero',
  trust_badge_1_desc: 'Recibe tus productos en 7-15 días',
  trust_badge_2_title: 'Devolución Gratis',
  trust_badge_2_desc: 'Devuelve fácilmente en 30 días',
  trust_badge_3_title: 'Pago Seguro',
  trust_badge_3_desc: 'Múltiples opciones de pago',
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
