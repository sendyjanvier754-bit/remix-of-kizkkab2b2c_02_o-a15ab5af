import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ReturnStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'agreement_reached'
  | 'under_mediation'
  | 'cancelled';

export type ReturnResolutionType = 'refund' | 'exchange' | 'store_credit' | 'agreement';

export interface OrderReturnRequest {
  id: string;
  order_id: string;
  order_type: 'b2b' | 'b2c';
  buyer_id: string;
  seller_id: string | null;
  status: ReturnStatus;
  reason: string;
  reason_type: string | null;
  amount_requested: number | null;
  amount_approved: number | null;
  resolution_type: ReturnResolutionType | null;
  seller_notes: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReturnInput {
  order_id: string;
  order_type: 'b2b' | 'b2c';
  seller_id?: string;
  reason: string;
  reason_type?: string;
  amount_requested?: number;
}

export interface UpdateReturnInput {
  id: string;
  status?: ReturnStatus;
  seller_notes?: string;
  admin_notes?: string;
  amount_approved?: number;
  resolution_type?: ReturnResolutionType;
  reviewed_by?: string;
  reviewed_at?: string;
  resolved_at?: string;
}

export const RETURN_STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string; bgColor: string }> = {
  pending:           { label: 'Pendiente',       color: 'text-amber-700',  bgColor: 'bg-amber-100'  },
  accepted:          { label: 'Aceptada',         color: 'text-green-700',  bgColor: 'bg-green-100'  },
  rejected:          { label: 'Rechazada',        color: 'text-red-700',    bgColor: 'bg-red-100'    },
  processing:        { label: 'Procesando',       color: 'text-blue-700',   bgColor: 'bg-blue-100'   },
  completed:         { label: 'Completada',       color: 'text-emerald-700',bgColor: 'bg-emerald-100'},
  agreement_reached: { label: 'Acuerdo Logrado',  color: 'text-purple-700', bgColor: 'bg-purple-100' },
  under_mediation:   { label: 'Mediación Admin',  color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  cancelled:         { label: 'Cancelada',        color: 'text-gray-600',   bgColor: 'bg-gray-100'   },
};

// ── User: fetch own return requests ──────────────────────────────────────────
export const useMyReturnRequests = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['return_requests', 'buyer', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('order_return_requests')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OrderReturnRequest[];
    },
    enabled: !!user?.id,
  });
};

// ── Seller: fetch return requests on their orders ─────────────────────────────
export const useSellerReturnRequests = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['return_requests', 'seller', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('order_return_requests')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OrderReturnRequest[];
    },
    enabled: !!user?.id,
  });
};

// ── Admin: fetch all return requests ─────────────────────────────────────────
export const useAdminReturnRequests = (statusFilter?: ReturnStatus) => {
  return useQuery({
    queryKey: ['return_requests', 'admin', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('order_return_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OrderReturnRequest[];
    },
  });
};

// ── Check if a specific order has a return request ────────────────────────────
export const useOrderReturnStatus = (orderId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['return_requests', 'order', orderId],
    queryFn: async () => {
      if (!orderId || !user?.id) return null;
      const { data } = await supabase
        .from('order_return_requests')
        .select('id, status, created_at')
        .eq('order_id', orderId)
        .eq('buyer_id', user.id)
        .maybeSingle();
      return data as { id: string; status: ReturnStatus; created_at: string } | null;
    },
    enabled: !!orderId && !!user?.id,
  });
};

// ── Mutations ─────────────────────────────────────────────────────────────────
export const useCreateReturnRequest = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReturnInput) => {
      if (!user?.id) throw new Error('No autenticado');
      const { data, error } = await supabase
        .from('order_return_requests')
        .insert({
          order_id: input.order_id,
          order_type: input.order_type,
          buyer_id: user.id,
          seller_id: input.seller_id || null,
          reason: input.reason,
          reason_type: input.reason_type || null,
          amount_requested: input.amount_requested || null,
          status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return_requests'] });
      toast.success('Solicitud de devolución enviada');
    },
    onError: (e: any) => toast.error(e.message || 'Error al crear solicitud'),
  });
};

export const useUpdateReturnRequest = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateReturnInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('order_return_requests')
        .update({
          ...updates,
          reviewed_by: updates.reviewed_by ?? user?.id,
          reviewed_at: updates.reviewed_at ?? new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return_requests'] });
      toast.success('Solicitud actualizada');
    },
    onError: (e: any) => toast.error(e.message || 'Error al actualizar'),
  });
};
