import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CheckResult {
  success: boolean;
  action: string;
  product_name: string;
  pending_orders_b2b: number;
  pending_orders_b2c: number;
  total_pending: number;
}

interface DeleteResult {
  success: boolean;
  action?: string;
  product_id?: string;
  product_name?: string;
  variants_deleted?: number;
  orders_cancelled?: number;
  refunds_created?: number;
  images_marked_for_cleanup?: number;
  pending_orders?: number;
  message?: string;
  error?: string;
}

export function useProductDeletion() {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  /**
   * Verificar pedidos pendientes antes de eliminar
   */
  const checkPendingOrders = useCallback(async (productId: string): Promise<CheckResult | null> => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.rpc('delete_product_cascade', {
        p_product_id: productId,
        p_delete_reason: '',
        p_action: 'check',
      });
      if (error) throw new Error(error.message);
      const result = data as unknown as CheckResult;
      setCheckResult(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error verificando pedidos';
      toast.error(msg);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Ejecutar eliminación con acción específica
   */
  const executeDelete = useCallback(async (
    productId: string,
    productName: string,
    action: 'delete' | 'delete_cancel' | 'delete_keep',
    deleteReason: string = 'Producto descontinuado',
    onSuccess?: () => void,
  ): Promise<DeleteResult | null> => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_product_cascade', {
        p_product_id: productId,
        p_delete_reason: deleteReason,
        p_action: action,
      });
      if (error) throw new Error(error.message);
      const result = data as unknown as DeleteResult;

      if (!result.success) throw new Error(result.error || 'Error eliminando producto');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);

      if (result.action === 'discontinued') {
        toast.success(`"${productName}" desactivado. Los pedidos pendientes continuarán.`);
      } else {
        let msg = `✓ "${productName}" eliminado`;
        if (result.variants_deleted && result.variants_deleted > 0) msg += ` • ${result.variants_deleted} variante(s)`;
        if (result.orders_cancelled && result.orders_cancelled > 0) msg += ` • ${result.orders_cancelled} pedido(s) cancelado(s)`;
        if (result.refunds_created && result.refunds_created > 0) msg += ` • ${result.refunds_created} reembolso(s)`;
        toast.success(msg);
      }

      onSuccess?.();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al eliminar producto: ${msg}`);
      return { success: false, error: msg };
    } finally {
      setIsDeleting(false);
      setCheckResult(null);
    }
  }, [queryClient]);

  return {
    checkPendingOrders,
    executeDelete,
    isDeleting,
    isChecking,
    checkResult,
    setCheckResult,
  };
}
