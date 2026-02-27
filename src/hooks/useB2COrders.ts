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
}

export interface CreateB2COrderParams {
  items: B2COrderItem[];
  total_amount: number;
  total_quantity: number;
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

export const useCreateB2COrder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateB2COrderParams) => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Create the order - using orders_b2b with buyer_id for B2C orders
      // seller_id will be the first store's owner or a system seller for B2C
      const firstStoreId = params.items[0]?.store_id;
      let sellerId = user.id; // Default to buyer if no store found

      if (firstStoreId) {
        const { data: store } = await supabase
          .from('stores')
          .select('owner_user_id')
          .eq('id', firstStoreId)
          .single();
        
        if (store?.owner_user_id) {
          sellerId = store.owner_user_id;
        }
      }

      const orderMetadata: Record<string, any> = {};
      
      if (params.shipping_address) {
        orderMetadata.shipping_address = params.shipping_address;
      }
      
      if (params.payment_reference) {
        orderMetadata.payment_reference = params.payment_reference;
      }

      if (params.delivery_method) {
        orderMetadata.delivery_method = params.delivery_method;
      }

      if (params.pickup_point_id) {
        orderMetadata.pickup_point_id = params.pickup_point_id;
      }

      orderMetadata.order_type = 'b2c';
      orderMetadata.items_by_store = params.items.reduce((acc, item) => {
        const storeKey = item.store_id || 'unknown';
        if (!acc[storeKey]) {
          acc[storeKey] = {
            store_name: item.store_name || 'Tienda',
            items: [],
            subtotal: 0
          };
        }
        acc[storeKey].items.push(item);
        acc[storeKey].subtotal += item.subtotal;
        return acc;
      }, {} as Record<string, any>);

      // Determine payment_status based on payment method (like B2B)
      const paymentStatus = params.payment_method === 'stripe' 
        ? 'pending' 
        : 'pending_validation';

      // Create order with proper payment state machine
      const { data: order, error: orderError } = await supabase
        .from('orders_b2b')
        .insert({
          seller_id: sellerId,
          buyer_id: user.id,
          total_amount: params.total_amount,
          total_quantity: params.total_quantity,
          payment_method: params.payment_method,
          payment_status: paymentStatus,
          status: 'placed',
          currency: 'USD',
          notes: params.notes || null,
          metadata: orderMetadata,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items (use precio_total column, not subtotal)
      const orderItems = params.items.map(item => ({
        order_id: order.id,
        product_id: null, // B2C items come from seller_catalog, not products table
        sku: item.sku,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        precio_total: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from('order_items_b2b')
        .insert(orderItems);

      if (itemsError) {
        // Rollback order if items fail
        await supabase.from('orders_b2b').delete().eq('id', order.id);
        throw itemsError;
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
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
        .from('orders_b2b')
        .select('*')
        .eq('buyer_id', user.id)
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
        total_quantity: data.total_quantity,
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
      const { error } = await supabase
        .from('orders_b2b')
        .update({ 
          payment_status: 'paid',
          status: 'paid',
          payment_confirmed_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      return { orderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success('¡Pago confirmado!');
    },
    onError: (error: Error) => {
      console.error('Error confirming payment:', error);
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

      // 1. Get order with items before cancelling
      const { data: order, error: orderError } = await supabase
        .from('orders_b2b')
        .select(`
          *,
          order_items_b2b (*)
        `)
        .eq('id', orderId)
        .eq('buyer_id', user.id)
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
        // Create new cart
        const { data: newCart, error: cartCreateError } = await supabase
          .from('b2c_carts')
          .insert({ user_id: user.id, status: 'open' })
          .select('id')
          .single();

        if (cartCreateError) throw cartCreateError;
        cartId = newCart.id;
      }

      // 3. Restore order items to cart
      const orderItems = order.order_items_b2b || [];
      const metadata = order.metadata as Record<string, any> | null;
      const itemsByStore = metadata?.items_by_store || {};

      if (orderItems.length > 0) {
        const cartItems = orderItems.map((item: any) => {
          // Try to find store info from metadata
          let storeId: string | null = null;
          let storeName: string | null = null;
          let storeWhatsapp: string | null = null;
          let image: string | null = null;

          // Search in itemsByStore for matching item
          Object.entries(itemsByStore).forEach(([sId, storeData]: [string, any]) => {
            const foundItem = storeData?.items?.find((i: any) => i.sku === item.sku);
            if (foundItem) {
              storeId = sId !== 'unknown' ? sId : null;
              storeName = storeData.store_name;
              image = foundItem.image;
            }
          });

          return {
            cart_id: cartId,
            sku: item.sku,
            nombre: item.nombre,
            quantity: item.cantidad,
            unit_price: item.precio_unitario,
            total_price: item.subtotal,
            store_id: storeId,
            store_name: storeName,
            store_whatsapp: storeWhatsapp,
            image: image,
            seller_catalog_id: null, // Will need to be fetched if needed
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
        .from('orders_b2b')
        .update({ 
          payment_status: 'cancelled',
          status: 'cancelled',
          metadata: {
            ...metadata,
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'buyer',
            items_restored_to_cart: true,
          }
        })
        .eq('id', orderId)
        .eq('buyer_id', user.id);

      if (cancelError) throw cancelError;
      return { orderId, itemsRestored: orderItems.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
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
