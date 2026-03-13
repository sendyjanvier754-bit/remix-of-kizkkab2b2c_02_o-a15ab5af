import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface B2COrderItemRow {
  id: string;
  order_id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  seller_catalog_id: string | null;
  variant_info: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
}

export interface BuyerB2COrder {
  id: string;
  buyer_user_id: string;
  store_id: string | null;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  subtotal: number | null;
  shipping_cost: number | null;
  discount_amount: number | null;
  currency: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  delivery_method: string | null;
  shipping_address: Record<string, any> | null;
  pickup_point_id: string | null;
  notes: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any> | null;
  order_items_b2c: B2COrderItemRow[];
  store: { name: string | null; logo_url: string | null } | null;
}

export const useBuyerB2COrders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['buyer-b2c-orders', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('orders_b2c')
        .select(`
          *,
          order_items_b2c (*),
          store:stores (name, logo)
        `)
        .eq('buyer_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useBuyerB2COrders] query error:', error);
        throw error;
      }
      // Normalize store: map logo → logo_url for consistent interface
      const normalized = (data || []).map((o: any) => ({
        ...o,
        store: o.store ? { name: o.store.name, logo_url: o.store.logo } : null,
      }));
      return normalized as unknown as BuyerB2COrder[];
    },
  });

  // Real-time subscription for orders_b2c changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('buyer-b2c-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders_b2c',
          filter: `buyer_user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
};
