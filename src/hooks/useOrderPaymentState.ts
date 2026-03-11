/**
 * Order Payment State Machine Hook
 * Manages order states: draft -> pending -> paid/failed/expired
 * Handles stock reservation and cart locking
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PaymentStatus = 
  | 'draft' 
  | 'pending' 
  | 'pending_validation' 
  | 'paid' 
  | 'failed' 
  | 'expired' 
  | 'cancelled';

export interface ActiveOrder {
  id: string;
  payment_status: PaymentStatus;
  status: string;
  total_amount: number;
  total_quantity: number;
  payment_method: string | null;
  reserved_at: string | null;
  reservation_expires_at: string | null;
  stock_reserved: boolean;
  checkout_session_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface OrderPaymentStateResult {
  activeOrder: ActiveOrder | null;
  isLoading: boolean;
  isCartLocked: boolean;
  timeRemaining: number | null; // seconds until reservation expires
  
  // Actions
  startCheckout: (orderId: string, paymentMethod: string) => Promise<boolean>;
  confirmPayment: (orderId: string) => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  retryPayment: (orderId: string) => Promise<boolean>;
  
  // Refresh
  refreshActiveOrder: () => Promise<void>;
}

export const useOrderPaymentState = (): OrderPaymentStateResult => {
  const { user } = useAuth();
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Check if cart should be locked (order in pending state)
  const isCartLocked = activeOrder?.payment_status === 'pending' || 
                       activeOrder?.payment_status === 'pending_validation';

  // Fetch active pending order for user
  const fetchActiveOrder = useCallback(async () => {
    if (!user?.id) {
      setActiveOrder(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders_b2b')
        .select('*')
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .in('payment_status', ['pending', 'pending_validation'])
        .eq('stock_reserved', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const rawData = data as any;
        setActiveOrder({
          id: rawData.id,
          payment_status: rawData.payment_status as PaymentStatus,
          status: rawData.status,
          total_amount: Number(rawData.total_amount),
          total_quantity: rawData.total_quantity,
          payment_method: rawData.payment_method,
          reserved_at: rawData.reserved_at ?? null,
          reservation_expires_at: rawData.reservation_expires_at ?? null,
          stock_reserved: rawData.stock_reserved,
          checkout_session_id: rawData.checkout_session_id ?? null,
          metadata: rawData.metadata as Record<string, any> | null,
          created_at: rawData.created_at,
        });
      } else {
        setActiveOrder(null);
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
      setActiveOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Subscribe to realtime order updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('order-payment-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders_b2b',
          filter: `seller_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Order update received:', payload);
          fetchActiveOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchActiveOrder]);

  // Calculate time remaining for reservation
  useEffect(() => {
    if (!activeOrder?.reservation_expires_at || !isCartLocked) {
      setTimeRemaining(null);
      return;
    }

    const calculateRemaining = () => {
      const expiresAt = new Date(activeOrder.reservation_expires_at!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remaining);

      // If expired, refresh to get updated state
      if (remaining === 0) {
        fetchActiveOrder();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);

    return () => clearInterval(interval);
  }, [activeOrder?.reservation_expires_at, isCartLocked, fetchActiveOrder]);

  // Initial fetch
  useEffect(() => {
    fetchActiveOrder();
  }, [fetchActiveOrder]);

  // Start checkout - move order to pending and reserve stock
  const startCheckout = useCallback(async (orderId: string, paymentMethod: string): Promise<boolean> => {
    try {
      const paymentStatus = paymentMethod === 'stripe' ? 'pending' : 'pending_validation';
      
      const { error } = await supabase
        .from('orders_b2b')
        .update({ 
          payment_status: paymentStatus as any,
          payment_method: paymentMethod,
        })
        .eq('id', orderId);

      if (error) throw error;

      await fetchActiveOrder();
      return true;
    } catch (error: any) {
      console.error('Error starting checkout:', error);
      toast.error(error.message || 'Error al iniciar el pago');
      return false;
    }
  }, [fetchActiveOrder]);

  // Confirm payment - move order to paid
  const confirmPayment = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('orders_b2b')
        .update({ 
          payment_status: 'paid' as any,
          status: 'paid',
          payment_verified_by: user?.id ?? null,
        })
        .eq('id', orderId);

      if (error) throw error;

      setActiveOrder(null);
      toast.success('¡Pago confirmado!');
      return true;
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      toast.error(error.message || 'Error al confirmar el pago');
      return false;
    }
  }, []);

  // Cancel order - release stock
  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('orders_b2b')
        .update({ 
          payment_status: 'cancelled' as any,
          status: 'cancelled',
        })
        .eq('id', orderId);

      if (error) throw error;

      setActiveOrder(null);
      toast.info('Pedido cancelado. El stock ha sido liberado.');
      return true;
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      toast.error(error.message || 'Error al cancelar el pedido');
      return false;
    }
  }, []);

  // Retry payment - reset to draft
  const retryPayment = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('orders_b2b')
        .update({ 
          payment_status: 'pending' as any, // reset to pending instead of draft (not in DB enum)
          status: 'draft',
          stock_reserved: false,
        } as any)
        .eq('id', orderId);

      if (error) throw error;

      setActiveOrder(null);
      toast.info('Puedes intentar el pago nuevamente');
      return true;
    } catch (error: any) {
      console.error('Error retrying payment:', error);
      toast.error(error.message || 'Error al reintentar');
      return false;
    }
  }, []);

  return {
    activeOrder,
    isLoading,
    isCartLocked,
    timeRemaining,
    startCheckout,
    confirmPayment,
    cancelOrder,
    retryPayment,
    refreshActiveOrder: fetchActiveOrder,
  };
};
