import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
}

export interface Payment {
  id: string;
  payment_number: string;
  seller: Seller;
  amount: number;
  currency: string;
  method: 'stripe' | 'moncash' | 'transfer';
  reference: string;
  status: 'pending' | 'verified' | 'rejected';
  notes: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface PaymentStats {
  pending: number;
  verified: number;
  rejected: number;
  totalVolume: number;
}

export const usePayments = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({ pending: 0, verified: 0, rejected: 0, totalVolume: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('b2b_payments')
        .select(`
          id,
          payment_number,
          amount,
          currency,
          method,
          reference,
          status,
          notes,
          created_at,
          verified_at,
          seller_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedPayments: Payment[] = (data || []).map((p: any) => ({
        id: p.id,
        payment_number: p.payment_number,
        seller: { id: p.seller_id, name: p.seller_id?.slice(0, 8) || 'Seller', email: '', phone: null, business_name: null },
        amount: parseFloat(p.amount),
        currency: p.currency,
        method: p.method,
        reference: p.reference,
        status: p.status,
        notes: p.notes,
        created_at: p.created_at,
        verified_at: p.verified_at,
      }));

      setPayments(formattedPayments);
      
      // Calculate stats
      const pending = formattedPayments.filter(p => p.status === 'pending').length;
      const verified = formattedPayments.filter(p => p.status === 'verified').length;
      const rejected = formattedPayments.filter(p => p.status === 'rejected').length;
      const totalVolume = formattedPayments
        .filter(p => p.status === 'verified')
        .reduce((acc, p) => acc + p.amount, 0);

      setStats({ pending, verified, rejected, totalVolume });
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los pagos',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: 'verified' | 'rejected') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'verified' && user) {
        updateData.verified_by = user.id;
        updateData.verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('b2b_payments')
        .update(updateData)
        .eq('id', paymentId);

      if (error) throw error;

      // Update local state
      setPayments(prev => prev.map(p => 
        p.id === paymentId 
          ? { ...p, status, verified_at: status === 'verified' ? new Date().toISOString() : null }
          : p
      ));

      // Recalculate stats
      await fetchPayments();

      toast({
        title: status === 'verified' ? 'Pago Verificado' : 'Pago Rechazado',
        description: `El pago ha sido ${status === 'verified' ? 'verificado' : 'rechazado'} exitosamente.`,
      });

      return true;
    } catch (error: any) {
      console.error('Error updating payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado del pago',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return {
    payments,
    stats,
    isLoading,
    updatePaymentStatus,
    refetch: fetchPayments,
  };
};

export const useSellers = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellersCount, setSellersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSellers = async () => {
    try {
      setIsLoading(true);
      const { data, error, count } = await supabase
        .from('stores')
        .select('id, name, owner_user_id', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: Seller[] = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        email: '',
        phone: null,
        business_name: null,
      }));

      setSellers(mapped);
      setSellersCount(count || 0);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  return { sellers, sellersCount, isLoading, refetch: fetchSellers };
};
