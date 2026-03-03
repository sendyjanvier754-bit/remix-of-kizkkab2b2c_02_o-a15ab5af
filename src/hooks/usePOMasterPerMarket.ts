/**
 * PO Master Per Market Hook
 * Manages perpetual PO cycle per destination market
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MarketPODashboardItem {
  market_id: string;
  market_name: string;
  market_code: string;
  active_po_id: string | null;
  active_po_number: string | null;
  cycle_start_at: string | null;
  total_orders: number;
  total_quantity: number;
  total_amount: number;
  china_tracking: string | null;
  close_mode: string | null;
  quantity_threshold: number | null;
  weight_threshold_kg: number | null;
  time_interval_hours: number | null;
  auto_close_enabled: boolean | null;
  closed_pos_count: number;
}

export interface POMarketSettings {
  id: string;
  market_id: string;
  auto_close_enabled: boolean;
  close_mode: string;
  close_cron_expression: string | null;
  quantity_threshold: number;
  weight_threshold_kg: number;
  time_interval_hours: number;
  is_active: boolean;
}

export function usePOMasterPerMarket() {
  const queryClient = useQueryClient();

  // Dashboard: all markets with their active POs
  const useDashboard = () => useQuery({
    queryKey: ['po-market-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_market_po_dashboard');
      if (error) throw error;
      return (data || []) as MarketPODashboardItem[];
    },
    refetchInterval: 30000,
  });

  // Orders in a specific PO
  const usePOOrders = (poId: string | null) => useQuery({
    queryKey: ['po-orders', poId],
    queryFn: async () => {
      if (!poId) return [];
      const { data, error } = await supabase
        .from('orders_b2b')
        .select(`
          *,
          buyer:profiles!orders_b2b_buyer_user_id_fkey(id, full_name, email)
        `)
        .eq('master_po_id', poId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!poId,
  });

  // Closed POs for a market
  const useClosedPOs = (marketId: string | null) => useQuery({
    queryKey: ['closed-pos', marketId],
    queryFn: async () => {
      if (!marketId) return [];
      const { data, error } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .eq('market_id', marketId)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!marketId,
  });

  // Market settings
  const useMarketSettings = (marketId: string | null) => useQuery({
    queryKey: ['po-market-settings', marketId],
    queryFn: async () => {
      if (!marketId) return null;
      const { data, error } = await supabase
        .from('po_market_settings')
        .select('*')
        .eq('market_id', marketId)
        .maybeSingle();
      if (error) throw error;
      return data as POMarketSettings | null;
    },
    enabled: !!marketId,
  });

  // Ensure active PO exists for market
  const ensureMarketPO = useMutation({
    mutationFn: async (marketId: string) => {
      const { data, error } = await supabase.rpc('get_or_create_market_po', {
        p_market_id: marketId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      if (data?.is_new) {
        toast.success(`Nueva PO creada: ${data.po_number}`);
      }
    },
    onError: () => toast.error('Error al crear PO'),
  });

  // Close PO and open next (perpetual cycle)
  const closePOAndOpenNext = useMutation({
    mutationFn: async ({ poId, reason }: { poId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('close_market_po_and_open_next', {
        p_po_id: poId,
        p_close_reason: reason || 'manual',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['po-orders'] });
      queryClient.invalidateQueries({ queryKey: ['closed-pos'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success(
        `PO ${data?.closed_po_number} cerrada → ${data?.orders_transitioned} pedidos en Preparación`,
        { description: `Nueva PO abierta automáticamente` }
      );
    },
    onError: () => toast.error('Error al cerrar PO'),
  });

  // Update China tracking
  const updateChinaTracking = useMutation({
    mutationFn: async ({ poId, tracking }: { poId: string; tracking: string }) => {
      const { data, error } = await supabase.rpc('update_po_china_tracking', {
        p_po_id: poId,
        p_china_tracking: tracking,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['po-orders'] });
      toast.success(`Tracking actualizado: ${data?.orders_updated} pedidos`);
    },
    onError: () => toast.error('Error al actualizar tracking'),
  });

  // Update/create market settings
  const updateMarketSettings = useMutation({
    mutationFn: async (settings: Partial<POMarketSettings> & { market_id: string }) => {
      const { data, error } = await supabase
        .from('po_market_settings')
        .upsert({
          market_id: settings.market_id,
          auto_close_enabled: settings.auto_close_enabled ?? false,
          close_mode: settings.close_mode ?? 'manual',
          close_cron_expression: settings.close_cron_expression ?? null,
          quantity_threshold: settings.quantity_threshold ?? 50,
          weight_threshold_kg: settings.weight_threshold_kg ?? 500,
          time_interval_hours: settings.time_interval_hours ?? 168,
          is_active: settings.is_active ?? true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'market_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-market-settings'] });
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      toast.success('Configuración de cierre actualizada');
    },
    onError: () => toast.error('Error al actualizar configuración'),
  });

  // Update PO logistics stage
  const updatePOStage = useMutation({
    mutationFn: async ({ poId, newStatus }: { poId: string; newStatus: string }) => {
      // Update all orders in this PO
      const { error } = await supabase
        .from('orders_b2b')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('master_po_id', poId);
      if (error) throw error;
      
      // Update PO status
      await supabase
        .from('master_purchase_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', poId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['po-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  return {
    useDashboard,
    usePOOrders,
    useClosedPOs,
    useMarketSettings,
    ensureMarketPO,
    closePOAndOpenNext,
    updateChinaTracking,
    updateMarketSettings,
    updatePOStage,
  };
}
