import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type BuyerOrderStatus = 'draft' | 'placed' | 'paid' | 'preparing' | 'in_transit' | 'shipped' | 'delivered' | 'cancelled';
export type RefundStatus = 'none' | 'requested' | 'processing' | 'completed' | 'rejected';

export interface BuyerOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento_percent: number | null;
  subtotal: number;
  image?: string | null;
}

export type PaymentStatus = 'draft' | 'pending' | 'pending_validation' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface BuyerOrder {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  status: BuyerOrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  total_quantity: number;
  currency: string;
  payment_method: string | null;
  notes: string | null;
  metadata: {
    tracking_number?: string;
    carrier?: string;
    carrier_url?: string;
    estimated_delivery?: string;
    cancellation_reason?: string;
    cancelled_at?: string;
    cancelled_by?: 'buyer' | 'seller' | 'admin';
    refund_status?: RefundStatus;
    refund_amount?: number;
    refund_requested_at?: string;
    refund_completed_at?: string;
    [key: string]: any;
  } | null;
  created_at: string;
  updated_at: string;
  shipping_cost_total_usd?: number | null;
  shipping_cost_global_usd?: number | null;
  shipping_cost_local_usd?: number | null;
  order_items_b2b?: BuyerOrderItem[];
  seller_profile?: { full_name: string | null; email: string | null } | null;
}

export const useBuyerOrders = (statusFilter?: BuyerOrderStatus | 'all') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['buyer-orders', user?.id, statusFilter],
    enabled: !!user?.id, // Solo ejecutar cuando el usuario esté cargado
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all orders where user is the buyer (both B2C orders and any orders where they're buyer)
      const { data, error } = await supabase
        .from('orders_b2b')
        .select(`
          *,
          order_items_b2b (*),
          seller_profile:profiles!orders_b2b_seller_id_fkey (full_name, email)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let filteredData = data as unknown as BuyerOrder[];

      if (statusFilter && statusFilter !== 'all') {
        filteredData = filteredData.filter(order => order.status === statusFilter);
      }

      return filteredData;
    },
  });
};

export const useBuyerOrder = (orderId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['buyer-order', orderId],
    queryFn: async () => {
      if (!user?.id || !orderId) return null;

      const { data, error } = await supabase
        .from('orders_b2b')
        .select(`
          *,
          order_items_b2b (*),
          seller_profile:profiles!orders_b2b_seller_id_fkey (full_name, email)
        `)
        .eq('id', orderId)
        .eq('buyer_id', user.id)
        .single();

      if (error) throw error;
      return data as BuyerOrder;
    },
    enabled: !!user?.id && !!orderId,
  });
};

// Hook for B2B orders where seller is the buyer (seller purchases from other sellers)
// This includes orders where user is buyer_id OR seller_id (for B2B self-purchases)
export const useBuyerB2BOrders = (statusFilter?: BuyerOrderStatus | 'all') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['buyer-b2b-orders', user?.id, statusFilter],
    enabled: !!user?.id, // Solo ejecutar cuando el usuario esté cargado
    queryFn: async () => {
      if (!user?.id) return [];

      // Get orders where user is the buyer OR the seller (for B2B purchases)
      // Using OR filter for buyer_id and seller_id
      const { data, error } = await supabase
        .from('orders_b2b')
        .select(`
          *,
          order_items_b2b (*, products:product_id(imagen_principal)),
          seller_profile:profiles!orders_b2b_seller_id_fkey (full_name, email)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .neq('status', 'draft') // Exclude drafts
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Collect all unique SKU bases and variant IDs for bulk fetch
      const skuBasesNeeded: string[] = [];
      const variantIdsNeeded: string[] = [];
      (data || []).forEach(order => {
        (order.order_items_b2b || []).forEach((item: any) => {
          // If item has variant_id, collect it
          if (item.variant_id && !variantIdsNeeded.includes(item.variant_id)) {
            variantIdsNeeded.push(item.variant_id);
          }
          // Collect SKU bases for items without product_id
          if (!item.product_id && item.sku) {
            const skuBase = item.sku.split('-')[0];
            if (skuBase && !skuBasesNeeded.includes(skuBase)) {
              skuBasesNeeded.push(skuBase);
            }
          }
        });
      });

      // Fetch product images by sku_interno if needed
      let productImageMap: Record<string, string> = {};
      if (skuBasesNeeded.length > 0) {
        // For order details, use vista to get correct product info with B2B prices
        const { data: productsData } = await supabase
          .from('v_productos_con_precio_b2b')
          .select('sku_interno, imagen_principal')
          .in('sku_interno', skuBasesNeeded);
        
        if (productsData) {
          productsData.forEach(p => {
            if (p.sku_interno && p.imagen_principal) {
              productImageMap[p.sku_interno] = p.imagen_principal;
            }
          });
        }
      }

      // Fetch variant info (images, prices) if needed
      let variantInfoMap: Record<string, { image: string | null; precio_b2b_final: number }> = {};
      if (variantIdsNeeded.length > 0) {
        const { data: variantsData } = await supabase
          .from('v_variantes_con_precio_b2b')
          .select('id, images, precio_b2b_final')
          .in('id', variantIdsNeeded);
        
        if (variantsData) {
          variantsData.forEach(v => {
            if (v.id) {
              const imageArray = v.images ? (Array.isArray(v.images) ? v.images : [v.images]) : [];
              variantInfoMap[v.id] = {
                image: imageArray[0] || null,
                precio_b2b_final: v.precio_b2b_final || 0
              };
            }
          });
        }
      }

      // Map items to include image and correct price from variant or product
      const ordersWithImages = (data || []).map(order => ({
        ...order,
        order_items_b2b: (order.order_items_b2b || []).map((item: any) => {
          let image = item.products?.imagen_principal || null;
          let precio_b2b = item.unit_price || 0; // Original price from order
          
          // If item has variant_id, try to get variant info
          if (item.variant_id && variantInfoMap[item.variant_id]) {
            const variantInfo = variantInfoMap[item.variant_id];
            if (!image) image = variantInfo.image;
            // Note: For historical orders, we keep the price that was paid (unit_price)
            // but we can show the current variant price for reference if needed
          }
          
          // If no image and we have SKU, try from SKU lookup
          if (!image && item.sku) {
            const skuBase = item.sku.split('-')[0];
            image = productImageMap[skuBase] || null;
          }
          
          return {
            ...item,
            image,
            products: undefined, // Remove nested products object
          };
        })
      }));

      let filteredData = ordersWithImages as BuyerOrder[];

      if (statusFilter && statusFilter !== 'all') {
        filteredData = filteredData.filter(order => order.status === statusFilter);
      }

      return filteredData;
    },
  });
};

export const useCancelBuyerOrder = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      orderId, 
      reason,
      requestRefund = false
    }: { 
      orderId: string; 
      reason: string;
      requestRefund?: boolean;
    }) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      // First get the current order to check status, get metadata and items
      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders_b2b')
        .select(`
          status, metadata, total_amount, buyer_id,
          order_items_b2b (*)
        `)
        .eq('id', orderId)
        .eq('buyer_id', user?.id)
        .single();

      if (fetchError) throw fetchError;

      // Only allow cancellation for certain statuses
      if (!['placed', 'paid'].includes(currentOrder.status)) {
        throw new Error('Este pedido no puede ser cancelado en su estado actual');
      }

      // Restore items to cart
      const orderItems = currentOrder.order_items_b2b || [];
      const metadata = currentOrder.metadata as Record<string, any> | null;
      
      if (orderItems.length > 0) {
        // Get or create cart
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

        // Restore items
        const itemsByStore = metadata?.items_by_store || {};
        const cartItems = orderItems.map((item: any) => {
          let storeId: string | null = null;
          let storeName: string | null = null;
          let image: string | null = null;

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
            image: image,
          };
        });

        const { error: insertError } = await supabase
          .from('b2c_cart_items')
          .insert(cartItems);

        if (insertError) {
          console.error('Error restoring cart items:', insertError);
        }
      }

      const existingMetadata = (metadata && typeof metadata === 'object') 
        ? metadata as Record<string, any>
        : {};

      const newMetadata = {
        ...existingMetadata,
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'buyer' as const,
        items_restored_to_cart: orderItems.length > 0,
        refund_status: requestRefund && currentOrder.status === 'paid' ? 'requested' as RefundStatus : 'none' as RefundStatus,
        refund_amount: requestRefund ? currentOrder.total_amount : undefined,
        refund_requested_at: requestRefund ? new Date().toISOString() : undefined,
      };

      const { data, error } = await supabase
        .from('orders_b2b')
        .update({ 
          status: 'cancelled',
          payment_status: 'cancelled',
          metadata: newMetadata,
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)
        .eq('buyer_id', user?.id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, itemsRestored: orderItems.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-order'] });
      queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });
      toast({ 
        title: 'Pedido cancelado',
        description: data.itemsRestored > 0 
          ? `${data.itemsRestored} productos restaurados al carrito. ${variables.requestRefund ? 'Tu solicitud de reembolso ha sido enviada.' : ''}`
          : variables.requestRefund 
            ? 'Tu solicitud de reembolso ha sido enviada' 
            : 'El pedido ha sido cancelado exitosamente'
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error al cancelar',
        description: error.message,
        variant: 'destructive'
      });
    },
  });
};

// Hook to complete/mark B2B cart as completed
export const useCompleteB2BCart = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartId: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      console.log('Marking B2B cart as completed:', cartId);

      const { error } = await supabase
        .from('b2b_carts')
        .update({ status: 'completed' })
        .eq('id', cartId)
        .eq('buyer_user_id', user.id);

      if (error) throw error;
      
      console.log('B2B cart marked as completed successfully');
      
      // Wait a bit for DB to sync
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { cartId };
    },
    onSuccess: (data) => {
      console.log('B2B cart completion success, invalidating queries');
      // Clear all cart-related queries immediately
      queryClient.setQueryData(['b2b-cart-items', user?.id], []);
      // Invalidate cart queries to force refetch
      queryClient.invalidateQueries({ queryKey: ['b2b-cart-items'] });
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['b2b-cart-items'], type: 'active' });
    },
    onError: (error: Error) => {
      console.error('Error completing B2B cart:', error);
    },
  });
};
