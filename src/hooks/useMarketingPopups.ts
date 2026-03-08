import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MarketingPopup {
  id: string;
  title: string;
  description: string | null;
  trigger_type: 'welcome' | 'exit_intent' | 'cart_abandon' | 'timed_promotion';
  heading: string;
  body_text: string | null;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  background_color: string | null;
  discount_code_id: string | null;
  auto_generate_coupon: boolean;
  auto_coupon_config: any;
  display_frequency: 'once_per_session' | 'once_per_day' | 'once_ever' | 'always';
  delay_seconds: number;
  scroll_percentage: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  target_audience: string;
  target_pages: string[];
  views_count: number;
  clicks_count: number;
  conversions_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  discount_code?: { id: string; code: string; discount_type: string; discount_value: number; is_active: boolean } | null;
}

export type CreatePopupParams = Omit<MarketingPopup, 'id' | 'views_count' | 'clicks_count' | 'conversions_count' | 'created_at' | 'updated_at' | 'discount_code'>;

export function useMarketingPopups() {
  const queryClient = useQueryClient();

  const { data: popups = [], isLoading } = useQuery({
    queryKey: ['marketing-popups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_popups')
        .select('*, discount_codes(id, code, discount_type, discount_value, is_active)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        discount_code: p.discount_codes || null,
      })) as MarketingPopup[];
    },
  });

  const createPopup = useMutation({
    mutationFn: async (params: Partial<CreatePopupParams>) => {
      const { data, error } = await supabase
        .from('marketing_popups')
        .insert(params as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-popups'] });
      toast.success('Pop-up creado exitosamente');
    },
    onError: (e: any) => toast.error(e.message || 'Error al crear pop-up'),
  });

  const updatePopup = useMutation({
    mutationFn: async ({ id, ...params }: { id: string } & Partial<CreatePopupParams>) => {
      const { error } = await supabase
        .from('marketing_popups')
        .update({ ...params, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-popups'] });
      toast.success('Pop-up actualizado');
    },
    onError: (e: any) => toast.error(e.message || 'Error al actualizar'),
  });

  const togglePopup = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('marketing_popups')
        .update({ is_active, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-popups'] });
    },
  });

  const deletePopup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_popups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-popups'] });
      toast.success('Pop-up eliminado');
    },
    onError: (e: any) => toast.error(e.message || 'Error al eliminar'),
  });

  return { popups, isLoading, createPopup, updatePopup, togglePopup, deletePopup };
}

// Hook for public popup display
export function useActivePopups(triggerType?: string) {
  return useQuery({
    queryKey: ['active-popups', triggerType],
    queryFn: async () => {
      let query = supabase
        .from('marketing_popups')
        .select('*, discount_codes(id, code, discount_type, discount_value)')
        .eq('is_active', true)
        .or('starts_at.is.null,starts_at.lte.' + new Date().toISOString())
        .or('ends_at.is.null,ends_at.gte.' + new Date().toISOString());

      if (triggerType) {
        query = query.eq('trigger_type', triggerType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        discount_code: p.discount_codes || null,
      })) as MarketingPopup[];
    },
    staleTime: 60_000,
  });
}

// Hook to track dismissals
export function usePopupDismissal() {
  const getSessionId = () => {
    let sid = sessionStorage.getItem('popup_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('popup_session_id', sid);
    }
    return sid;
  };

  const isDismissed = (popupId: string, frequency: string): boolean => {
    const key = `popup_dismissed_${popupId}`;
    const val = localStorage.getItem(key);
    if (!val) return false;

    if (frequency === 'once_ever') return true;
    if (frequency === 'once_per_day') {
      const dismissedDate = new Date(val).toDateString();
      return dismissedDate === new Date().toDateString();
    }
    if (frequency === 'once_per_session') {
      return sessionStorage.getItem(key) === 'true';
    }
    return false;
  };

  const dismiss = async (popupId: string, frequency: string) => {
    const key = `popup_dismissed_${popupId}`;
    localStorage.setItem(key, new Date().toISOString());
    if (frequency === 'once_per_session') {
      sessionStorage.setItem(key, 'true');
    }

    // Track in DB (fire & forget)
    const sessionId = getSessionId();
    supabase.from('popup_dismissals').insert({
      popup_id: popupId,
      session_id: sessionId,
    } as any).then();
  };

  const incrementView = async (popupId: string) => {
    supabase.rpc('increment_popup_views' as any, { popup_id: popupId }).then();
  };

  return { isDismissed, dismiss, incrementView };
}
