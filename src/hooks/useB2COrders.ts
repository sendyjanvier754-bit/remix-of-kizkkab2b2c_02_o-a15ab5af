import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  variant_info?: Record<string, any>;
}

export interface CreateB2COrderParams {
  items: B2COrderItem[];
  total_amount: number;
  total_quantity: number;
  subtotal?: number;
  shipping_cost?: number;
  discount_amount?: number;
  payment_method: 'stripe' | 'moncash' | 'natcash' | 'transfer';
  payment_reference?: string;
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

/**
 * Creates one orders_b2c record per store (multi-vendor split).
 * Returns the array of created order IDs.
 */
export const useCreateB2COrder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateB2COrderParams) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      // Group items by store_id
      const itemsByStore = new Map<string, B2COrderItem[]>();
      for (const item of params.items) {
        const key = item.store_id || 'unknown';
        if (!itemsByStore.has(key)) itemsByStore.set(key, []);
        itemsByStore.get(key)!.push(item);
      }

      const paymentStatus = params.payment_method === 'stripe' ? 'pending' : 'pending_validation';
      const createdOrders: any[] = [];

      for (const [storeId, storeItems] of itemsByStore) {
        const storeSubtotal = storeItems.reduce((sum, i) => sum + i.subtotal, 0);
        // Proportionally distribute shipping & discount across stores
        const storeFraction = params.subtotal ? storeSubtotal / (params.subtotal || storeSubtotal) : 1;
        const storeShipping = Math.round(((params.shipping_cost || 0) * storeFraction) * 100) / 100;
        const storeDiscount = Math.round(((params.discount_amount || 0) * storeFraction) * 100) / 100;
        const storeTotal = storeSubtotal + storeShipping - storeDiscount;

        // Insert order
        const { data: order, error: orderError } = await supabase
          .from('orders_b2c')
          .insert({
            buyer_user_id: user.id,
            store_id: storeId !== 'unknown' ? storeId : null,
            subtotal: storeSubtotal,
            shipping_cost: storeShipping,
            discount_amount: storeDiscount,
            total_amount: storeTotal,
            payment_method: params.payment_method,
            payment_status: paymentStatus as any,
            delivery_method: params.delivery_method || 'pickup_point',
            shipping_address: params.shipping_address ? (params.shipping_address as any) : {},
            pickup_point_id: params.delivery_method === 'pickup' ? (params.pickup_point_id || null) : null,
            notes: params.notes || null,
            payment_reference: params.payment_reference || null,
            currency: 'USD',
            status: 'pending',
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Insert order items
        const orderItems = storeItems.map(item => ({
          order_id: order.id,
          seller_catalog_id: item.seller_catalog_id || null,
          sku: item.sku,
          product_name: item.nombre,
          quantity: item.cantidad,
          unit_price: item.precio_unitario,
          total_price: item.subtotal,
          variant_info: item.variant_info || {},
          metadata: {
            image: item.image || null,
            store_id: item.store_id || null,
            store_name: item.store_name || null,
          },
        }));

        const { error: itemsError } = await supabase
          .from('order_items_b2c')
          .insert(orderItems);

        if (itemsError) {
          // Rollback this order if items fail
          await supabase.from('orders_b2c').delete().eq('id', order.id);
          throw itemsError;
        }

        createdOrders.push(order);
      }

      return createdOrders[0]; // Return first order for display purposes
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
      queryClient.invalidateQueries({ queryKey: ['active-b2c-order'] });
      toast.success('¡Pedido creado exitosamente!');
    },
    onError: (error: Error) => {
      console.error('Error creating B2C order:', error);
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

      // Delete all items from the cart
      const { error: deleteItemsError } = await supabase
        .from('b2c_cart_items')
        .delete()
        .eq('cart_id', cartId);

      if (deleteItemsError) {
        console.error('Error deleting cart items:', deleteItemsError);
      }

      // Update cart status to completed
      const { error } = await supabase
        .from('b2c_carts')
        .update({ status: 'completed' })
        .eq('id', cartId)
        .eq('user_id', user.id);

      if (error) throw error;
      return { cartId };
    },
    onSuccess: () => {
      queryClient.setQueryData(['b2c-cart-items', user?.id], []);
      queryClient.setQueryData(['b2c-cart-items'], []);
      queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
    },
    onError: (error: Error) => {
      console.error('Error completing cart:', error);
    },
  });
};

// Hook to get active B2C order (pending payment)
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
        payment_reference: data.payment_reference,
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
      const { error } = await supabase
        .from('orders_b2c')
        .update({
          payment_status: 'paid' as any,
          status: 'confirmed',
          payment_confirmed_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      return { orderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
      queryClient.invalidateQueries({ queryKey: ['active-b2c-order'] });
      toast.success('¡Pago confirmado!');
    },
    onError: (error: Error) => {
      console.error('Error confirming B2C payment:', error);
      toast.error('Error al confirmar el pago');
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

      // 1. Get order with items
      const { data: order, error: orderError } = await supabase
        .from('orders_b2c')
        .select(`*, order_items_b2c(*)`)
        .eq('id', orderId)
        .eq('buyer_user_id', user.id)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) throw new Error('Pedido no encontrado');

      // 2. Get or create open cart
      let cartId: string;
      const { data: existingCart } = await supabase
        .from('b2c_carts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
      if (orderItems.length > 0) {
        const cartItems = orderItems.map((item: any) => ({
          cart_id: cartId,
          sku: item.sku,
          nombre: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          store_id: item.metadata?.store_id || null,
          store_name: item.metadata?.store_name || null,
          image: item.metadata?.image || null,
          seller_catalog_id: item.seller_catalog_id || null,
        }));

        await supabase.from('b2c_cart_items').insert(cartItems);
      }

      // 4. Cancel the order
      const { error: cancelError } = await supabase
        .from('orders_b2c')
        .update({
          payment_status: 'cancelled' as any,
          status: 'cancelled',
          metadata: {
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'buyer',
            items_restored_to_cart: true,
          },
        })
        .eq('id', orderId)
        .eq('buyer_user_id', user.id);

      if (cancelError) throw cancelError;
      return { orderId, itemsRestored: orderItems.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
      queryClient.invalidateQueries({ queryKey: ['active-b2c-order'] });
      queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });
      toast.info(data.itemsRestored > 0
        ? `Pedido cancelado. ${data.itemsRestored} productos restaurados al carrito.`
        : 'Pedido cancelado');
    },
    onError: (error: Error) => {
      console.error('Error cancelling B2C order:', error);
      toast.error('Error al cancelar el pedido');
    },
  });
};
