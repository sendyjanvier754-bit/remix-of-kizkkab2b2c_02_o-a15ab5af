/**
 * Consolidation Engine Hook
 * Manages automatic order grouping into Purchase Orders (PO)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useCallback } from 'react';

// Types
export type ConsolidationMode = 'time' | 'quantity' | 'hybrid';

export interface ConsolidationSettings {
  mode: ConsolidationMode;
  time_interval_hours: number;
  order_quantity_threshold: number;
  notify_threshold_percent: number;
  is_active: boolean;
}

export interface ActivePO {
  id: string;
  po_number: string;
  status: string;
  total_orders: number;
  total_quantity: number;
  total_amount: number;
  cycle_start_at: string;
  auto_close_at: string | null;
}

export interface ConsolidationProgress {
  orders_current: number;
  orders_threshold: number;
  percent_full: number;
  time_remaining_seconds: number | null;
  time_remaining_formatted: string;
}

export interface ConsolidationStats {
  settings: ConsolidationSettings;
  active_po: ActivePO;
  progress: ConsolidationProgress;
}

export const useConsolidationEngine = () => {
  const queryClient = useQueryClient();

  // Fetch consolidation stats
  const useConsolidationStats = () => useQuery({
    queryKey: ['consolidation-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_consolidation_stats');
      if (error) throw error;
      return data as unknown as ConsolidationStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch raw settings for editing
  const useConsolidationSettings = () => useQuery({
    queryKey: ['consolidation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consolidation_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async (params: {
      mode?: ConsolidationMode;
      time_hours?: number;
      quantity_threshold?: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await (supabase.rpc as any)('update_consolidation_settings', {
        p_mode: params.mode || null,
        p_time_hours: params.time_hours || null,
        p_quantity_threshold: params.quantity_threshold || null,
        p_is_active: params.is_active ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['consolidation-settings'] });
      toast.success('Configuración actualizada');
    },
    onError: () => toast.error('Error al actualizar configuración'),
  });

  // Manual close PO
  const manualClosePO = useMutation({
    mutationFn: async (poId: string) => {
      const { data, error } = await (supabase.rpc as any)('auto_close_po', {
        p_po_id: poId,
        p_close_reason: 'manual',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['current-open-po'] });
      toast.success(`PO ${data?.closed_po_number} cerrada`, {
        description: `${data?.orders_consolidated || 0} pedidos consolidados`,
      });
    },
    onError: () => toast.error('Error al cerrar PO'),
  });

  // Check for auto-close (can be called manually or on interval)
  const checkAutoClose = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('check_po_auto_close');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['consolidation-stats'] });
        queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
        toast.success(`PO cerrada automáticamente`, {
          description: `Razón: ${data?.close_reason === 'time_threshold' ? 'Tiempo cumplido' : 'Cantidad alcanzada'}`,
        });
      }
    },
  });

  // Create/ensure active PO exists
  const ensureActivePO = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_or_create_active_po');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['current-open-po'] });
    },
  });

  // Helper to format time remaining
  const formatTimeRemaining = useCallback((seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, []);

  // Calculate urgency level based on progress
  const getUrgencyLevel = useCallback((stats: ConsolidationStats | undefined): 'low' | 'medium' | 'high' | 'critical' => {
    if (!stats) return 'low';
    
    const { progress, settings } = stats;
    
    // Check quantity
    if (progress.percent_full >= 100) return 'critical';
    if (progress.percent_full >= settings.notify_threshold_percent) return 'high';
    if (progress.percent_full >= 50) return 'medium';
    
    // Check time (if applicable)
    if (progress.time_remaining_seconds !== null) {
      const hoursRemaining = progress.time_remaining_seconds / 3600;
      if (hoursRemaining <= 1) return 'critical';
      if (hoursRemaining <= 6) return 'high';
      if (hoursRemaining <= 12) return 'medium';
    }
    
    return 'low';
  }, []);

  // Real-time subscription for order updates
  const useRealtimeOrderUpdates = (enabled: boolean = true) => {
    useEffect(() => {
      if (!enabled) return;

      const channel = supabase
        .channel('consolidation-orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders_b2b',
          },
          () => {
            // Refresh stats when orders change
            queryClient.invalidateQueries({ queryKey: ['consolidation-stats'] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [enabled]);
  };

  // Auto-check for time-based closes
  useEffect(() => {
    const interval = setInterval(() => {
      checkAutoClose.mutate();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return {
    useConsolidationStats,
    useConsolidationSettings,
    updateSettings,
    manualClosePO,
    checkAutoClose,
    ensureActivePO,
    formatTimeRemaining,
    getUrgencyLevel,
    useRealtimeOrderUpdates,
  };
};
