import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { fetchOrderEmailData, sendOrderConfirmationEmail, sendPaymentDetailsEmail, sendSellerNewOrderEmail, sendOrderCancelledEmail } from '@/hooks/useOrderEmails';

export interface B2COrderItem {
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  image?: string;
  store_id?: string;
  store_name?: string;
  seller_catalog_id?: string;
}

export interface CreateB2COrderParams {
  items: B2COrderItem[];
  total_amount: number;
  payment_method: 'stripe' | 'moncash' | 'natcash' | 'transfer';
  payment_reference?: string;
  shipping_cost?: number;
  discount_amount?: number;
  /** Per-store shipping cost map: { [storeId]: cost }. If provided, overrides shipping_cost split. */
  store_shipping_costs?: Record<string, number>;
  notes?: string;
  shipping_address?: {
    id: string;
    full_name: string;
    phone?: string;
    street_address: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    notes?: string;
  };
  delivery_method?: 'address' | 'pickup';
  pickup_point_id?: string;
}

export const useCreateB2COrder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateB2COrderParams) => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      const paymentStatus = params.payment_method === 'stripe'
        ? 'pending'
        : 'pending_validation';

      // Group items by store_id for multi-vendor split
      const itemsByStore: Record<string, B2COrderItem[]> = {};
      for (const item of params.items) {
        const key = item.store_id || 'unknown';
        if (!itemsByStore[key]) itemsByStore[key] = [];
        itemsByStore[key].push(item);
      }

      const storeIds = Object.keys(itemsByStore);
      const totalSubtotal = params.items.reduce((s, i) => s + i.subtotal, 0);
      const totalDiscount = params.discount_amount || 0;

      const createdOrderIds: string[] = [];

      try {
        let firstOrder: any = null;

        for (const storeId of storeIds) {
          const storeItems = itemsByStore[storeId];
          const storeSubtotal = storeItems.reduce((s, i) => s + i.subtotal, 0);

          // Proportional discount per store (Amazon/ML style)
          const storeDiscount = totalSubtotal > 0
            ? totalDiscount * (storeSubtotal / totalSubtotal)
            : 0;

          // Each store charges its own shipping (passed from checkout)
          const storeShipping = params.store_shipping_costs?.[storeId] ?? 0;
          const storeTotalAmount = storeSubtotal + storeShipping - storeDiscount;

          const { data: order, error: orderError } = await supabase
            .from('orders_b2c')
            .insert({
              buyer_user_id: user.id,
              store_id: storeId !== 'unknown' ? storeId : null,
              subtotal: storeSubtotal,
              shipping_cost: storeShipping,
              discount_amount: storeDiscount,
              total_amount: storeTotalAmount,
              payment_method: params.payment_method,
              payment_reference: params.payment_reference || null,
              payment_status: paymentStatus as any,
              delivery_method: params.delivery_method || null,
              shipping_address: params.shipping_address as any || null,
              pickup_point_id: params.pickup_point_id || null,
              notes: params.notes || null,
              status: 'placed',
              currency: 'USD',
              metadata: {
                store_name: storeItems[0]?.store_name || null,
              } as any,
            })
            .select()
            .single();

          if (orderError) throw orderError;
          createdOrderIds.push(order.id);
          if (!firstOrder) firstOrder = order;

          // Insert order_items_b2c for this store's items
          const orderItems = storeItems.map(item => ({
            order_id: order.id,
            product_name: item.nombre,
            quantity: item.cantidad,
            unit_price: item.precio_unitario,
            total_price: item.subtotal,
            seller_catalog_id: item.seller_catalog_id || null,
            sku: item.sku || null,
            metadata: {
              image: item.image || null,
              store_id: item.store_id || null,
              store_name: item.store_name || null,
            } as any,
          }));

          const { error: itemsError } = await supabase
            .from('order_items_b2c')
            .insert(orderItems);

          if (itemsError) throw itemsError;
        }

        return firstOrder;
      } catch (err) {
        // Rollback all created orders on any failure
        if (createdOrderIds.length > 0) {
          await supabase.from('orders_b2c').delete().in('id', createdOrderIds);
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
      queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });
      toast.success('¡Pedido creado exitosamente!');
    },
    onError: (error: Error) => {
      console.error('Error creating order:', error);
      toast.error('Error al crear el pedido');
    },
  });
};

// Hook to complete/mark B2C cart as completed
export const useCompleteB2CCart = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartId: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      console.log('Marking cart as completed:', cartId);

      // First, delete all items from the cart to ensure it's empty
      const { error: deleteItemsError } = await supabase
        .from('b2c_cart_items')
        .delete()
        .eq('cart_id', cartId);

      if (deleteItemsError) {
        console.error('Error deleting cart items:', deleteItemsError);
      }

      // Then update cart status to completed
      const { error } = await supabase
        .from('b2c_carts')
        .update({ status: 'completed' })
        .eq('id', cartId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      console.log('Cart marked as completed and items deleted successfully');
      
      return { cartId };
    },
    onSuccess: () => {
      console.log('Cart completion success, invalidating queries');
      // Clear all cart-related queries immediately
      queryClient.setQueryData(['b2c-cart-items', user?.id], []);
      queryClient.setQueryData(['b2c-cart-items'], []);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
    },
    onError: (error: Error) => {
      console.error('Error completing cart:', error);
    },
  });
};

// Hook to get active B2C order for payment state
export const useActiveB2COrder = () => {
  const { user } = useAuth();
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActiveOrder = useCallback(async () => {
    if (!user?.id) {
      setActiveOrder(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders_b2c')
        .select('*')
        .eq('buyer_user_id', user.id)
        .in('payment_status', ['pending', 'pending_validation'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setActiveOrder(data ? {
        id: data.id,
        payment_status: data.payment_status,
        status: data.status,
        total_amount: Number(data.total_amount),
        payment_method: data.payment_method,
        metadata: data.metadata,
        created_at: data.created_at,
      } : null);
    } catch (error) {
      console.error('Error fetching active B2C order:', error);
      setActiveOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActiveOrder();
  }, [fetchActiveOrder]);

  const isCartLocked = activeOrder?.payment_status === 'pending' ||
                       activeOrder?.payment_status === 'pending_validation';

  return { activeOrder, isLoading, isCartLocked, refreshActiveOrder: fetchActiveOrder };
};

// Hook to confirm B2C payment
export const useConfirmB2CPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      // Buyer only notifies payment — status moves to pending_validation
      // The ADMIN must confirm receipt before it becomes 'paid'
      const { error } = await supabase
        .from('orders_b2c')
        .update({
          payment_status: 'pending_validation' as any,
          status: 'placed',
        })
        .eq('id', orderId);

      if (error) throw error;
      return { orderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
      toast.success('Comprobante enviado. El admin verificará tu pago en breve.');
    },
    onError: (error: Error) => {
      console.error('Error al enviar comprobante:', error);
      toast.error('Error al enviar el comprobante');
    },
  });
};

// Hook to cancel B2C order and restore items to cart
export const useCancelB2COrder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      // 1. Get order with items before cancelling
      const { data: order, error: orderError } = await supabase
        .from('orders_b2c')
        .select(`
          *,
          order_items_b2c (*)
        `)
        .eq('id', orderId)
        .eq('buyer_user_id', user.id)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) throw new Error('Pedido no encontrado');

      // 2. Get or create an open cart for the user
      let cartId: string;
      const { data: existingCart, error: cartFetchError } = await supabase
        .from('b2c_carts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cartFetchError) throw cartFetchError;

      if (existingCart?.id) {
        cartId = existingCart.id;
      } else {
        const { data: newCart, error: cartCreateError } = await supabase
          .from('b2c_carts')
          .insert({ user_id: user.id, status: 'open' })
          .select('id')
          .single();

        if (cartCreateError) throw cartCreateError;
        cartId = newCart.id;
      }

      // 3. Restore order items to cart
      const orderItems = (order as any).order_items_b2c || [];
      const metadata = order.metadata as Record<string, any> | null;

      if (orderItems.length > 0) {
        const cartItems = orderItems.map((item: any) => {
          const itemMeta = item.metadata as Record<string, any> | null;
          return {
            cart_id: cartId,
            sku: item.sku || null,
            nombre: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            store_id: itemMeta?.store_id || order.store_id || null,
            store_name: itemMeta?.store_name || null,
            image: itemMeta?.image || null,
            seller_catalog_id: item.seller_catalog_id || null,
          };
        });

        const { error: insertError } = await supabase
          .from('b2c_cart_items')
          .insert(cartItems);

        if (insertError) {
          console.error('Error restoring cart items:', insertError);
          // Don't throw - we still want to cancel the order
        }
      }

      // 4. Cancel the order
      const { error: cancelError } = await supabase
        .from('orders_b2c')
        .update({
          payment_status: 'cancelled' as any,
          status: 'cancelled',
          metadata: {
            ...metadata,
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'buyer',
            items_restored_to_cart: true,
          } as any,
        })
        .eq('id', orderId)
        .eq('buyer_user_id', user.id);

      if (cancelError) throw cancelError;
      return { orderId, itemsRestored: orderItems.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
      queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });
      toast.info(data.itemsRestored > 0
        ? `Pedido cancelado. ${data.itemsRestored} productos restaurados al carrito.`
        : 'Pedido cancelado');
    },
    onError: (error: Error) => {
      console.error('Error cancelling order:', error);
      toast.error('Error al cancelar el pedido');
    },
  });
};
