import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PendingProofOrder {
  id: string;
  type: 'b2b' | 'b2c';
  total_amount: number;
  currency: string;
  payment_method: string | null;
  created_at: string;
  action_url: string;
}

const PENDING = ['pending', 'pending_validation', 'placed'];

const needsProof = (o: any) =>
  o.payment_method !== 'stripe' &&
  PENDING.includes(String(o.payment_status)) &&
  o.status !== 'cancelled' &&
  !(o.metadata as any)?.payment_proof_url;

/** Orders of the current user paid manually that still have no payment proof attached. */
export const usePendingPaymentProofs = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pending-payment-proofs', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<PendingProofOrder[]> => {
      const cols = 'id,total_amount,currency,payment_method,payment_status,status,metadata,created_at';
      const [b2b, b2c] = await Promise.all([
        supabase.from('orders_b2b').select(cols).eq('buyer_id', user!.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('orders_b2c').select(cols).eq('buyer_user_id', user!.id).order('created_at', { ascending: false }).limit(30),
      ]);
      const map = (rows: any[] | null, type: 'b2b' | 'b2c') =>
        (rows || []).filter(needsProof).map((o) => ({
          id: o.id,
          type,
          total_amount: Number(o.total_amount || 0),
          currency: o.currency || 'USD',
          payment_method: o.payment_method,
          created_at: o.created_at,
          action_url: `${type === 'b2b' ? '/seller/mis-compras' : '/mis-compras'}?order=${o.id}&upload=1`,
        }));
      return [...map(b2b.data, 'b2b'), ...map(b2c.data, 'b2c')].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });
};
