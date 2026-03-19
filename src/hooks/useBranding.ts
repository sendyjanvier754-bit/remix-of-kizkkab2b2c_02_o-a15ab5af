import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const BRANDING_CACHE_KEY = 'branding_settings_cache';

/**
 * Branding defaults — used as fallback when the DB has no value.
 * These are the only hardcoded strings; everything else reads from `branding_settings`.
 */
const DEFAULTS: Record<string, string> = {
  platform_name: '',
  platform_slogan: '',
  logo_url: '',
  favicon_url: '',
  browser_tab_title: '',
  browser_meta_description: '',
  share_title: '',
  share_description: '',
  share_image_url: '',
  meta_title: '',
  meta_description: '',
  // Payment method icon defaults — point to the existing static files
  payment_icon_visa: '/visa.png',
  payment_icon_mastercard: '/mastercard.png',
  payment_icon_amex: '/american-express.png',
  payment_icon_applepay: '/apple-pay.png',
  payment_icon_googlepay: '/google-pay.png',
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
  // Loading screen media — empty means fall back to favicon
  // loader_media_type: 'image' | 'gif' | 'video'
  // loader_media_fit: 'cover' | 'contain'
  loader_media_url: '',
  loader_media_type: 'image',
  loader_media_fit: 'cover',
  loader_ring_color: '#1d4ed8',
  loader_ring_size: '96',
  loader_ring_width: '4',
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
      const rows = (data as { key: string; value: string }[]) || [];

      if (typeof window !== 'undefined' && rows.length > 0) {
        try {
          const map: Record<string, string> = {};
          rows.forEach((r) => {
            map[r.key] = r.value;
          });
          window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(map));
        } catch {
          // no-op (localStorage unavailable)
        }
      }

      return rows;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getValue = (key: string): string => {
    const found = settings.find((s) => s.key === key);
    if (found?.value) return found.value;

    if (typeof window !== 'undefined') {
      try {
        const cachedRaw = window.localStorage.getItem(BRANDING_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as Record<string, string>;
          if (cached?.[key]) return cached[key];
        }
      } catch {
        // no-op
      }
    }

    return DEFAULTS[key] || '';
  };

  return { getValue };
};
