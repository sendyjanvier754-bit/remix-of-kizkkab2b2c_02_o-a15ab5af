import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface B2COrderItem {
  id: string;
  sku: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  seller_catalog_id: string | null;
  variant_info: any;
  metadata: any;
}

export interface B2COrder {
  id: string;
  store_id: string | null;
  store_name?: string | null;
  order_number: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_confirmed_at: string | null;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  delivery_method: string | null;
  shipping_address: any;
  pickup_point_id: string | null;
  notes: string | null;
  tracking_number: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
  order_items_b2c: B2COrderItem[];
}

type B2COrderFilter = 'all' | 'pending' | 'confirmed' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled';

export const useBuyerB2COrders = (statusFilter: B2COrderFilter = 'all') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['buyer-b2c-orders', user?.id, statusFilter],
    queryFn: async (): Promise<B2COrder[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('orders_b2c')
        .select(`
          *,
          store:stores!orders_b2c_store_id_fkey(id, name, logo),
          order_items_b2c(*)
        `)
        .eq('buyer_user_id', user.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((order: any) => ({
        ...order,
        store_name: order.store?.name || null,
        subtotal: Number(order.subtotal) || 0,
        shipping_cost: Number(order.shipping_cost) || 0,
        discount_amount: Number(order.discount_amount) || 0,
        total_amount: Number(order.total_amount) || 0,
        order_items_b2c: (order.order_items_b2c || []).map((item: any) => ({
          ...item,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
        })),
      }));
    },
    enabled: !!user?.id,
  });
};

// B2C local logistics stages (no China/USA chain)
export type B2CLogisticsStage =
  | 'payment_pending'
  | 'payment_validated'
  | 'preparing'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export const b2cLogisticsStages: {
  key: B2CLogisticsStage;
  label: string;
  description: string;
}[] = [
  { key: 'payment_pending', label: 'Pago Pendiente', description: 'Esperando confirmación de pago' },
  { key: 'payment_validated', label: 'Pago Validado', description: 'Tu pago fue confirmado' },
  { key: 'preparing', label: 'Preparando', description: 'El vendedor está preparando tu pedido' },
  { key: 'in_transit', label: 'En Camino', description: 'Tu pedido está en camino' },
  { key: 'delivered', label: 'Entregado', description: 'Pedido entregado exitosamente' },
];

export const getB2CLogisticsStage = (order: B2COrder): B2CLogisticsStage => {
  if (order.status === 'cancelled') return 'cancelled';
  if (order.status === 'delivered') return 'delivered';
  if (order.status === 'in_transit' || order.tracking_number) return 'in_transit';
  if (order.status === 'preparing') return 'preparing';
  if (order.payment_status === 'paid' || order.status === 'confirmed') return 'payment_validated';
  return 'payment_pending';
};
