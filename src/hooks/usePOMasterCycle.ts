import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { POCloseResult } from '@/types/b2b-shipping';

/**
 * usePOMasterCycle
 * 
 * Gestión del ciclo perpetuo de PO Maestra:
 * - Cierre de PO con transición de órdenes
 * - Apertura automática de nueva PO
 * - Generación de IDs híbridos
 * - Instrucciones de packing automáticas
 */
export function usePOMasterCycle() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query: PO Maestra activa
  const {
    data: activePO,
    isLoading: loadingActivePO,
    refetch: refetchActivePO,
  } = useQuery({
    queryKey: ['active-po-master'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000, // 30 segundos
  });

  // Query: Órdenes en PO activa
  const {
    data: ordersInActivePO,
    isLoading: loadingOrders,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['orders-in-active-po', activePO?.id],
    queryFn: async () => {
      if (!activePO?.id) return [];

      const { data, error } = await supabase
        .from('orders_b2b')
        .select(`
          *,
          buyer:profiles!orders_b2b_buyer_id_fkey(id, full_name, email)
        `)
        .eq('master_po_id', activePO.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!activePO?.id,
    staleTime: 30 * 1000,
  });

  // Query: Historial de POs cerradas
  const {
    data: closedPOs,
    isLoading: loadingClosedPOs,
  } = useQuery({
    queryKey: ['closed-po-masters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000, // 1 minuto
  });

  /**
   * Cierra la PO activa y abre una nueva automáticamente
   */
  const closePOAndOpenNew = useCallback(async (
    poId: string,
    closeReason: string = 'manual'
  ): Promise<POCloseResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'close_po_and_open_new',
        {
          p_po_id: poId,
          p_close_reason: closeReason,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        toast.error(`Error al cerrar PO: ${rpcError.message}`);
        return null;
      }

      if (!data?.success) {
        setError(data?.error || 'Error al cerrar PO');
        toast.error(data?.error || 'Error al cerrar PO');
        return null;
      }

      // Invalidar queries
      await queryClient.invalidateQueries({ queryKey: ['active-po-master'] });
      await queryClient.invalidateQueries({ queryKey: ['closed-po-masters'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-in-active-po'] });

      toast.success(`PO ${data.closed_po_number} cerrada. ${data.orders_transitioned} órdenes en preparación. Nueva PO: ${data.new_po_number}`);
      
      return data as POCloseResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  /**
   * Genera ID híbrido para una orden específica
   */
  const generateHybridTrackingId = useCallback(async (
    orderId: string
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc(
        'generate_hybrid_tracking_id',
        { p_order_id: orderId }
      );

      if (error) {
        console.error('Error generating tracking ID:', error);
        return null;
      }

      return data as string;
    } catch (err) {
      console.error('Error generating tracking ID:', err);
      return null;
    }
  }, []);

  /**
   * Vincula una orden a la PO activa
   */
  const linkOrderToPO = useCallback(async (
    orderId: string,
    isExpress: boolean = false,
    isOversize: boolean = false,
    isSensitive: boolean = false
  ): Promise<boolean> => {
    if (!activePO?.id) {
      toast.error('No hay PO activa');
      return false;
    }

    try {
      const { error } = await supabase
        .from('orders_b2b')
        .update({
          master_po_id: activePO.id,
          is_express: isExpress,
          is_oversize: isOversize,
          is_sensitive: isSensitive,
          packing_instructions: isOversize 
            ? 'Embalaje Especial - Dimensiones XL'
            : isSensitive 
              ? 'Manejo Especial - Producto Frágil/Líquido/Batería'
              : 'Caja Estándar',
        })
        .eq('id', orderId);

      if (error) throw error;

      // Actualizar flags en PO
      if (isExpress || isOversize || isSensitive) {
        await supabase
          .from('master_purchase_orders')
          .update({
            has_express_orders: isExpress || activePO.has_express_orders,
            has_oversize_orders: isOversize || activePO.has_oversize_orders,
            has_sensitive_orders: isSensitive || activePO.has_sensitive_orders,
          })
          .eq('id', activePO.id);
      }

      await refetchOrders();
      return true;
    } catch (err) {
      console.error('Error linking order to PO:', err);
      return false;
    }
  }, [activePO, refetchOrders]);

  /**
   * Actualiza tracking de China en la PO
   */
  const updateChinaTracking = useCallback(async (
    poId: string,
    chinaTracking: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('master_purchase_orders')
        .update({ china_tracking: chinaTracking })
        .eq('id', poId);

      if (error) throw error;

      await refetchActivePO();
      toast.success('Tracking de China actualizado');
      return true;
    } catch (err) {
      console.error('Error updating China tracking:', err);
      toast.error('Error al actualizar tracking');
      return false;
    }
  }, [refetchActivePO]);

  /**
   * Actualiza tracking de tránsito en la PO
   */
  const updateTransitTracking = useCallback(async (
    poId: string,
    transitTracking: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('master_purchase_orders')
        .update({ transit_tracking: transitTracking })
        .eq('id', poId);

      if (error) throw error;

      await refetchActivePO();
      toast.success('Tracking de tránsito actualizado');
      return true;
    } catch (err) {
      console.error('Error updating transit tracking:', err);
      toast.error('Error al actualizar tracking');
      return false;
    }
  }, [refetchActivePO]);

  /**
   * Estadísticas de la PO activa
   */
  const poStats = {
    total_orders: ordersInActivePO?.length || 0,
    express_orders: ordersInActivePO?.filter(o => o.is_express).length || 0,
    oversize_orders: ordersInActivePO?.filter(o => o.is_oversize).length || 0,
    sensitive_orders: ordersInActivePO?.filter(o => o.is_sensitive).length || 0,
    total_amount: ordersInActivePO?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
    total_weight_g: ordersInActivePO?.reduce((sum, o) => sum + (o.total_weight_g || 0), 0) || 0,
  };

  return {
    // State
    loading,
    error,
    
    // Data
    activePO,
    ordersInActivePO,
    closedPOs,
    poStats,
    
    // Loading states
    loadingActivePO,
    loadingOrders,
    loadingClosedPOs,
    
    // Methods
    closePOAndOpenNew,
    generateHybridTrackingId,
    linkOrderToPO,
    updateChinaTracking,
    updateTransitTracking,
    refetchActivePO,
    refetchOrders,
  };
}

export default usePOMasterCycle;
