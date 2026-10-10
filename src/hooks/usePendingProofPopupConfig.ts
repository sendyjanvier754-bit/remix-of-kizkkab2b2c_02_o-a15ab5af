import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ProofPopupFrequency = 'every_visit' | 'once_per_session' | 'once_per_day';

export interface PendingProofPopupConfig {
  enabled: boolean;
  frequency: ProofPopupFrequency;
  delay_seconds: number;
  title: string;   // empty => translated default
  message: string; // empty => translated default
}

export const DEFAULT_PROOF_POPUP: PendingProofPopupConfig = {
  enabled: true,
  frequency: 'every_visit',
  delay_seconds: 2,
  title: '',
  message: '',
};

const KEY = 'pending_proof_popup';

export const usePendingProofPopupConfig = () =>
  useQuery({
    queryKey: ['platform-setting', KEY],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PendingProofPopupConfig> => {
      const { data } = await supabase.from('platform_settings').select('value').eq('key', KEY).maybeSingle();
      if (!data?.value) return DEFAULT_PROOF_POPUP;
      try {
        return { ...DEFAULT_PROOF_POPUP, ...JSON.parse(data.value) };
      } catch {
        return DEFAULT_PROOF_POPUP;
      }
    },
  });

export const useSavePendingProofPopupConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: PendingProofPopupConfig) => {
      const value = JSON.stringify(cfg);
      const { data: existing } = await supabase.from('platform_settings').select('id').eq('key', KEY).maybeSingle();
      const { error } = existing
        ? await supabase.from('platform_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', existing.id)
        : await supabase.from('platform_settings').insert({ key: KEY, value, description: 'Pop-up de pedidos pendientes de comprobante' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-setting', KEY] }),
  });
};
