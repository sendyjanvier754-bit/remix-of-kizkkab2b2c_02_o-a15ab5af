import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type RefundStatus = 
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface RefundRequest {
  id: string;
  order_id: string;
  order_number: string;
  buyer_user_id: string;
  buyer_name: string;
  buyer_email: string;
  amount: number;
  approved_amount?: number;
  reason: string;
  status: RefundStatus;
  request_type: 'automatic' | 'manual' | 'buyer_request';
  reviewed_by?: string;
  reviewer_email?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  refund_method?: string;
  refund_reference?: string;
  completed_at?: string;
  seller_id?: string;
  seller_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  status_history?: Array<{
    old_status: RefundStatus;
    new_status: RefundStatus;
    changed_by: string;
    changed_at: string;
    notes?: string;
  }>;
}

interface ChangeStatusParams {
  refundId: string;
  newStatus: RefundStatus;
  userId: string;
  notes?: string;
  rejectionReason?: string;
  approvedAmount?: number;
  refundMethod?: string;
  refundReference?: string;
}

interface ChangeStatusResult {
  success: boolean;
  refund_id?: string;
  old_status?: RefundStatus;
  new_status?: RefundStatus;
  changed_by?: string;
  changed_at?: string;
  error?: string;
}

/**
 * Hook para gestión de reembolsos por admin/seller
 * 
 * Flujo de estados:
 * pending → under_review → approved → processing → completed
 *                       ↓           ↓
 *                   rejected    cancelled
 */
export function useRefundManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query: Obtener todos los reembolsos (con filtros)
  const useRefunds = (filters?: {
    status?: RefundStatus | RefundStatus[];
    sellerId?: string;
    buyerId?: string;
    orderNumber?: string;
  }) => {
    return useQuery({
      queryKey: ['refunds', filters],
      queryFn: async () => {
        let query = supabase
          .from('v_refunds_management')
          .select('*')
          .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filters?.status) {
          if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
          } else {
            query = query.eq('status', filters.status);
          }
        }

        if (filters?.sellerId) {
          query = query.eq('seller_id', filters.sellerId);
        }

        if (filters?.buyerId) {
          query = query.eq('buyer_user_id', filters.buyerId);
        }

        if (filters?.orderNumber) {
          query = query.ilike('order_number', `%${filters.orderNumber}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data as RefundRequest[];
      },
    });
  };

  // Query: Obtener un reembolso específico con historial
  const useRefund = (refundId: string) => {
    return useQuery({
      queryKey: ['refund', refundId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('v_refunds_management')
          .select('*')
          .eq('id', refundId)
          .single();

        if (error) throw error;
        return data as RefundRequest;
      },
      enabled: !!refundId,
    });
  };

  // Mutation: Cambiar estado de reembolso
  const changeStatusMutation = useMutation({
    mutationFn: async (params: ChangeStatusParams) => {
      const { data, error } = await supabase.rpc('change_refund_status', {
        p_refund_id: params.refundId,
        p_new_status: params.newStatus,
        p_user_id: params.userId,
        p_notes: params.notes,
        p_rejection_reason: params.rejectionReason,
        p_approved_amount: params.approvedAmount,
        p_refund_method: params.refundMethod,
        p_refund_reference: params.refundReference,
      });

      if (error) throw error;

      const result = data as ChangeStatusResult;
      if (!result.success) {
        throw new Error(result.error || 'Error desconocido');
      }

      return result;
    },
    onSuccess: (data) => {
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      queryClient.invalidateQueries({ queryKey: ['refund', data.refund_id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Toast de éxito
      toast({
        title: 'Estado Actualizado',
        description: `Reembolso cambiado de "${data.old_status}" a "${data.new_status}"`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al Cambiar Estado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Helper: Mover a "En Revisión"
  const moveToReview = async (refundId: string, userId: string, notes?: string) => {
    return changeStatusMutation.mutateAsync({
      refundId,
      newStatus: 'under_review',
      userId,
      notes,
    });
  };

  // Helper: Aprobar reembolso
  const approve = async (
    refundId: string,
    userId: string,
    approvedAmount?: number,
    notes?: string
  ) => {
    return changeStatusMutation.mutateAsync({
      refundId,
      newStatus: 'approved',
      userId,
      approvedAmount,
      notes,
    });
  };

  // Helper: Rechazar reembolso
  const reject = async (
    refundId: string,
    userId: string,
    rejectionReason: string,
    notes?: string
  ) => {
    return changeStatusMutation.mutateAsync({
      refundId,
      newStatus: 'rejected',
      userId,
      rejectionReason,
      notes,
    });
  };

  // Helper: Procesar reembolso (iniciar transacción)
  const startProcessing = async (
    refundId: string,
    userId: string,
    refundMethod: string,
    refundReference?: string,
    notes?: string
  ) => {
    return changeStatusMutation.mutateAsync({
      refundId,
      newStatus: 'processing',
      userId,
      refundMethod,
      refundReference,
      notes,
    });
  };

  // Helper: Completar reembolso
  const complete = async (refundId: string, userId: string, notes?: string) => {
    return changeStatusMutation.mutateAsync({
      refundId,
      newStatus: 'completed',
      userId,
      notes,
    });
  };

  // Helper: Cancelar reembolso
  const cancel = async (refundId: string, userId: string, notes?: string) => {
    return changeStatusMutation.mutateAsync({
      refundId,
      newStatus: 'cancelled',
      userId,
      notes,
    });
  };

  // Helper: Confirmación con diálogo
  const confirmStatusChange = async (
    refundId: string,
    currentStatus: RefundStatus,
    newStatus: RefundStatus,
    userId: string,
    additionalData?: {
      notes?: string;
      rejectionReason?: string;
      approvedAmount?: number;
      refundMethod?: string;
      refundReference?: string;
    }
  ): Promise<void> => {
    const statusMessages: Record<RefundStatus, string> = {
      pending: 'Pendiente',
      under_review: 'En Revisión',
      approved: 'Aprobado',
      processing: 'Procesando',
      completed: 'Completado',
      rejected: 'Rechazado',
      cancelled: 'Cancelado',
    };

    const message = `¿Cambiar estado de "${statusMessages[currentStatus]}" a "${statusMessages[newStatus]}"?`;
    
    if (confirm(message)) {
      await changeStatusMutation.mutateAsync({
        refundId,
        newStatus,
        userId,
        ...additionalData,
      });
    }
  };

  // Query: Estadísticas de reembolsos
  const useRefundStats = (sellerId?: string) => {
    return useQuery({
      queryKey: ['refund-stats', sellerId],
      queryFn: async () => {
        let query = supabase
          .from('v_refunds_management')
          .select('status, amount');

        if (sellerId) {
          query = query.eq('seller_id', sellerId);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Calcular estadísticas
        const stats = {
          total: data.length,
          pending: data.filter((r) => r.status === 'pending').length,
          under_review: data.filter((r) => r.status === 'under_review').length,
          approved: data.filter((r) => r.status === 'approved').length,
          processing: data.filter((r) => r.status === 'processing').length,
          completed: data.filter((r) => r.status === 'completed').length,
          rejected: data.filter((r) => r.status === 'rejected').length,
          cancelled: data.filter((r) => r.status === 'cancelled').length,
          total_amount: data.reduce((sum, r) => sum + (r.amount || 0), 0),
          completed_amount: data
            .filter((r) => r.status === 'completed')
            .reduce((sum, r) => sum + (r.amount || 0), 0),
        };

        return stats;
      },
    });
  };

  return {
    useRefunds,
    useRefund,
    useRefundStats,
    changeStatus: changeStatusMutation.mutateAsync,
    confirmStatusChange,
    moveToReview,
    approve,
    reject,
    startProcessing,
    complete,
    cancel,
    isChangingStatus: changeStatusMutation.isPending,
    changeStatusError: changeStatusMutation.error,
  };
}

export default useRefundManagement;
