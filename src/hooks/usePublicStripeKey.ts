import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PublicStripeKey {
  publishable_key: string;
  mode: 'test' | 'live';
}

export function usePublicStripeKey() {
  const [data, setData] = useState<PublicStripeKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await supabase.rpc('get_active_stripe_publishable_key');
        if (cancelled) return;
        if (error) throw error;
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row?.publishable_key) {
          setData({ publishable_key: row.publishable_key, mode: row.mode as 'test' | 'live' });
        } else {
          setData(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
