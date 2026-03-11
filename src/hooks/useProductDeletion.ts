import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteProductResult {
  success: boolean;
  product_id?: string;
  product_name?: string;
  variants_deleted?: number;
  orders_cancelled?: number;
  refunds_created?: number;
  images_marked_for_cleanup?: number;
  delete_reason?: string;
  error?: string;
}

interface DeleteProductOptions {
  productId: string;
  productName: string;
  deleteReason?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * useProductDeletion
 * 
 * Hook para eliminación segura de productos con:
 * - Eliminación de variantes y SKUs
 * - Marcado de imágenes para limpieza
 * - Cancelación automática de pedidos pendientes
 * - Generación automática de reembolsos
 */
export function useProductDeletion() {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteProductResult | null>(null);

  /**
   * Eliminar producto con cascada completa
   */
  const deleteProduct = useCallback(async ({
    productId,
    productName,
    deleteReason = 'Producto descontinuado',
    onSuccess,
    onError,
  }: DeleteProductOptions): Promise<DeleteProductResult | null> => {
    setIsDeleting(true);
    setDeleteResult(null);

    try {
      const { data, error } = await supabase.rpc('delete_product_cascade', {
        p_product_id: productId,
        p_delete_reason: deleteReason,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = data as unknown as DeleteProductResult;

      if (!result.success) {
        throw new Error(result.error || 'Error eliminando producto');
      }

      setDeleteResult(result);

      // Invalidar queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);

      // Toast con resumen
      let message = `✓ Producto "${productName}" eliminado`;
      if (result.variants_deleted && result.variants_deleted > 0) {
        message += `\n• ${result.variants_deleted} variante(s) eliminada(s)`;
      }
      if (result.orders_cancelled && result.orders_cancelled > 0) {
        message += `\n• ${result.orders_cancelled} pedido(s) cancelado(s)`;
      }
      if (result.refunds_created && result.refunds_created > 0) {
        message += `\n• ${result.refunds_created} reembolso(s) generado(s)`;
      }

      toast.success(message);

      onSuccess?.();
      return result;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al eliminar producto: ${errorMsg}`);
      onError?.(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsDeleting(false);
    }
  }, [queryClient]);

  /**
   * Mutation de React Query para usar en componentes
   */
  const deleteProductMutation = useMutation({
    mutationFn: async (options: DeleteProductOptions) => {
      return deleteProduct(options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  /**
   * Limpiar imágenes huérfanas
   */
  const cleanupDeletedImages = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_deleted_product_images');

      if (error) throw error;

      if ((data as any)?.images_cleaned > 0) {
        toast.info(`${(data as any).images_cleaned} imágenes marcadas como limpiadas`);
      }

      return data;
    } catch (err) {
      console.error('Error limpiando imágenes:', err);
      return null;
    }
  }, []);

  /**
   * Confirmar eliminación con dialog
   */
  const confirmDelete = useCallback(async (
    productName: string,
    callback: () => void,
    productId?: string
  ) => {
    const confirmed = window.confirm(
      `¿Estás seguro de eliminar "${productName}"?\n\n` +
      `Esta acción:\n` +
      `• Eliminará todas las variantes y SKUs\n` +
      `• Cancelará pedidos pendientes\n` +
      `• Generará reembolsos automáticos\n` +
      `• Marcará imágenes para limpieza\n\n` +
      `Esta acción NO se puede deshacer.`
    );

    if (confirmed) {
      if (productId) {
        await deleteProduct({
          productId,
          productName,
          onSuccess: callback,
        });
      } else {
        callback();
      }
    }
  }, [deleteProduct]);

  return {
    deleteProduct,
    deleteProductMutation,
    cleanupDeletedImages,
    confirmDelete,
    isDeleting,
    deleteResult,
  };
}
