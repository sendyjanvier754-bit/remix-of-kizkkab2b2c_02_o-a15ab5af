import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrderEmailData, sendOrderStatusChangeEmail, sendOrderCancelledEmail } from '@/hooks/useOrderEmails';

export type OrderStatus = 'draft' | 'placed' | 'paid' | 'preparing' | 'shipped' | 'cancelled';
export type PaymentStatus = 'draft' | 'pending' | 'pending_validation' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id?: string | null;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento_percent?: number | null;
  subtotal?: number | null;
  precio_total?: number | null;
  image?: string | null;
  color?: string | null;
  size?: string | null;
}

export interface Order {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  status: OrderStatus;
  payment_status?: PaymentStatus | null;
  total_amount: number;
  total_quantity: number;
  currency: string;
  payment_method: string | null;
  notes: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  shipping_cost_total_usd?: number | null;
  shipping_cost_global_usd?: number | null;
  shipping_cost_local_usd?: number | null;
  profiles?: { full_name: string | null; email: string | null } | null;
  buyer_profile?: { full_name: string | null; email: string | null } | null;
  order_items_b2b?: OrderItem[];
}

export interface OrderFilters {
  status?: OrderStatus | 'all';
  paymentStatus?: PaymentStatus | 'all';
  orderType?: 'b2b' | 'b2c' | 'all';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useOrders = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch seller's orders (B2B orders where user is the buyer/seller)
  const useSellerOrders = (filters?: OrderFilters) => {
    return useQuery({
      queryKey: ['seller-orders', user?.id, filters],
      queryFn: async () => {
        if (!user?.id) return [];
        
        let query = supabase
          .from('orders_b2b')
          .select(`
            *,
            order_items_b2b (*)
          `)
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
          query = query.eq('payment_status', filters.paymentStatus as any);
        }
        if (filters?.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters?.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Order[];
      },
      enabled: !!user?.id,
    });
  };

  // Fetch seller's B2C sales (orders where the seller's store is the vendor)
  const useSellerB2CSales = (filters?: OrderFilters) => {
    const queryClient = useQueryClient();

    // Realtime subscription — updates automatically when a new B2C order arrives
    useEffect(() => {
      if (!user?.id) return;

      let storeId: string | null = null;

      // Get store id once and subscribe
      supabase
        .from('stores')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle()
        .then(({ data: store }) => {
          if (!store?.id) return;
          storeId = store.id;

          const channel = supabase
            .channel(`seller-b2c-orders-${storeId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'orders_b2c',
                filter: `store_id=eq.${storeId}`,
              },
              () => {
                queryClient.invalidateQueries({ queryKey: ['seller-b2c-sales', user?.id] });
                queryClient.invalidateQueries({ queryKey: ['b2c-sales-stats', user?.id] });
              }
            )
            .subscribe();

          return () => { supabase.removeChannel(channel); };
        });
    }, [user?.id, queryClient]);

    return useQuery({
      queryKey: ['seller-b2c-sales', user?.id, filters],
      queryFn: async () => {
        if (!user?.id) return [];
        
        // Get seller's store first
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_user_id', user.id)
          .maybeSingle();

        if (!store?.id) return [];
        
        // Query orders_b2c filtered by this seller's store_id
        let query = supabase
          .from('orders_b2c')
          .select(`
            *,
            order_items_b2c (*, seller_catalog(nombre, sku, images)),
            buyer_profile:profiles!orders_b2c_buyer_user_id_fkey (full_name, email)
          `)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false });

        if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
          query = query.eq('payment_status', filters.paymentStatus as any);
        }
        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status as any);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        // Map orders_b2c rows to the Order interface shape used across the page
        return (data || []).map((o: any) => ({
          id: o.id,
          seller_id: store.id,
          buyer_id: o.buyer_user_id,
          status: o.status as OrderStatus,
          payment_status: o.payment_status as PaymentStatus,
          total_amount: Number(o.total_amount),
          total_quantity: (o.order_items_b2c || []).reduce((s: number, i: any) => s + Number(i.quantity), 0),
          currency: o.currency || 'USD',
          payment_method: o.payment_method,
          payment_reference: o.payment_reference,
          notes: o.notes,
          metadata: o.metadata,
          created_at: o.created_at,
          updated_at: o.updated_at,
          shipping_address: o.shipping_address,
          buyer_profile: o.buyer_profile,
          order_items_b2c: o.order_items_b2c || [],
          order_items_b2b: [],
        })) as any[];
      },
      enabled: !!user?.id,
    });
  };

  // Fetch all orders (admin)
  const useAllOrders = (filters?: OrderFilters) => {
    return useQuery({
      queryKey: ['all-orders', filters],
      queryFn: async () => {
        let query = supabase
          .from('orders_b2b')
          .select(`
            *,
            profiles!orders_b2b_seller_id_fkey (full_name, email),
            order_items_b2b (*)
          `)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters?.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters?.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
        if (filters?.search) {
          query = query.or(`id.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Enrich items with variant/product images (for orders where image was not saved at checkout)
        const allItems = (data || []).flatMap(o => o.order_items_b2b || []);
        const variantIds = [...new Set(allItems.filter((i: any) => i.variant_id).map((i: any) => i.variant_id as string))];
        const productIds = [...new Set(allItems.filter((i: any) => i.product_id).map((i: any) => i.product_id as string))];
        // Items without variant_id → look up variant by SKU
        const skusWithoutVariantId = [...new Set(
          allItems.filter((i: any) => !i.variant_id && i.sku).map((i: any) => i.sku as string)
        )];

        const [variantsByIdRes, productImagesRes, variantsBySkuRes] = await Promise.all([
          variantIds.length > 0
            ? supabase.from('product_variants').select('id, sku, images').in('id', variantIds)
            : Promise.resolve({ data: [] }),
          productIds.length > 0
            ? supabase.from('products').select('id, imagen_principal').in('id', productIds)
            : Promise.resolve({ data: [] }),
          skusWithoutVariantId.length > 0
            ? supabase.from('product_variants').select('id, sku, images').in('sku', skusWithoutVariantId)
            : Promise.resolve({ data: [] }),
        ]);

        // variant_id → image
        const variantByIdImageMap = new Map<string, string>(
          (variantsByIdRes.data || [])
            .filter((v: any) => v.images?.[0])
            .map((v: any) => [v.id, Array.isArray(v.images) ? v.images[0] : v.images])
        );
        // sku → image (for items where variant_id is null)
        const variantBySkuImageMap = new Map<string, string>(
          (variantsBySkuRes.data || [])
            .filter((v: any) => v.images?.[0])
            .map((v: any) => [v.sku, Array.isArray(v.images) ? v.images[0] : v.images])
        );
        const productImageMap = new Map<string, string>(
          (productImagesRes.data || [])
            .filter((p: any) => p.imagen_principal)
            .map((p: any) => [p.id, p.imagen_principal])
        );

        return (data || []).map(order => ({
          ...order,
          order_items_b2b: (order.order_items_b2b || []).map((item: any) => ({
            ...item,
            image: item.image
              || (item.variant_id ? variantByIdImageMap.get(item.variant_id) : null)
              || (item.sku ? variantBySkuImageMap.get(item.sku) : null)
              || (item.product_id ? productImageMap.get(item.product_id) : null)
              || null,
          })),
        })) as Order[];
      },
    });
  };

  // Fetch single order
  const useOrder = (orderId: string) => {
    return useQuery({
      queryKey: ['order', orderId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('orders_b2b')
          .select(`
            *,
            profiles!orders_b2b_seller_id_fkey (full_name, email),
            order_items_b2b (*)
          `)
          .eq('id', orderId)
          .single();
        if (error) throw error;
        return data as Order;
      },
      enabled: !!orderId,
    });
  };

  // Update order status
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { data, error } = await supabase
        .from('orders_b2b')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast({ title: 'Estado del pedido actualizado' });
      // Send status change email async
      fetchOrderEmailData(variables.orderId, 'b2b').then(emailData => {
        if (emailData) sendOrderStatusChangeEmail({ ...emailData, newStatus: variables.status });
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar pedido', description: error.message, variant: 'destructive' });
    },
  });

  // Update order tracking info
  const updateOrderTracking = useMutation({
    mutationFn: async ({ 
      orderId, 
      carrier, 
      trackingNumber, 
      carrierUrl,
      estimatedDelivery 
    }: { 
      orderId: string; 
      carrier: string; 
      trackingNumber: string;
      carrierUrl?: string;
      estimatedDelivery?: string;
    }) => {
      const { data, error } = await supabase
        .from('orders_b2b')
        .update({ 
          metadata: {
            carrier,
            tracking_number: trackingNumber,
            carrier_url: carrierUrl || null,
            estimated_delivery: estimatedDelivery || null,
          },
          status: 'shipped',
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast({ title: 'Información de envío actualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar envío', description: error.message, variant: 'destructive' });
    },
  });

  // Cancel order
  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('orders_b2b')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      toast({ title: 'Pedido cancelado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al cancelar pedido', description: error.message, variant: 'destructive' });
    },
  });

  // Confirm manual payment via SECURITY DEFINER RPC
  const confirmManualPayment = useMutation({
    mutationFn: async ({ orderId, paymentNotes }: { orderId: string; paymentNotes?: string }) => {
      const payload = {
        p_order_id: orderId,
        p_admin_user_id: user?.id,
        p_payment_notes: paymentNotes || null,
      };

      let { data, error } = await supabase.rpc('admin_confirm_payment', payload);

      // Backward compatibility: some environments still expose p_notes instead of p_payment_notes
      if (error && /admin_confirm_payment/i.test(error.message || '')) {
        const { data: fallbackData, error: fallbackError } = await (supabase as any).rpc('admin_confirm_payment', {
          p_order_id: orderId,
          p_admin_user_id: user?.id,
          p_notes: paymentNotes || null,
        });
        data = fallbackData;
        error = fallbackError;
      }

      if (error) throw error;

      // Many SQL functions return JSON with success=false instead of raising SQL exceptions
      if (data && typeof data === 'object' && 'success' in (data as any) && (data as any).success === false) {
        const message = (data as any).error || 'No se pudo confirmar el pago';
        throw new Error(message);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['seller-b2c-sales'] });
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-b2b-orders'] });
      queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['current-open-po'] });
      queryClient.invalidateQueries({ queryKey: ['consolidation-stats'] });
      toast({ title: '¡Pago confirmado!', description: 'El pedido ha sido marcado como pagado y vinculado a la PO activa.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al confirmar pago', description: error.message, variant: 'destructive' });
    },
  });

  // Reject manual payment via SECURITY DEFINER RPC
  const rejectManualPayment = useMutation({
    mutationFn: async ({ orderId, rejectionReason }: { orderId: string; rejectionReason?: string }) => {
      const { data, error } = await (supabase as any).rpc('admin_reject_payment', {
        p_order_id: orderId,
        p_admin_user_id: user?.id,
        p_rejection_reason: rejectionReason || 'Pago no verificado',
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['seller-b2c-sales'] });
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-b2b-orders'] });
      toast({ title: 'Pago rechazado', description: 'El pedido ha sido cancelado.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al rechazar pago', description: error.message, variant: 'destructive' });
    },
  });

  // Cancel order and restore items to cart (for sellers/admins)
  const cancelOrderWithRestore = useMutation({
    mutationFn: async ({ orderId, restoreToCart = true }: { orderId: string; restoreToCart?: boolean }) => {
      // 1. Get order with items
      const { data: order, error: orderError } = await supabase
        .from('orders_b2b')
        .select(`
          *,
          order_items_b2b (*)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) throw new Error('Pedido no encontrado');

      const buyerId = order.buyer_id;
      const metadata = order.metadata as Record<string, any> | null;
      const orderItems = order.order_items_b2b || [];

      // 2. If should restore and there's a buyer, restore items to their cart
      if (restoreToCart && buyerId && orderItems.length > 0) {
        // Get or create cart for buyer
        let cartId: string;
        const { data: existingCart } = await supabase
          .from('b2c_carts')
          .select('id')
          .eq('user_id', buyerId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingCart?.id) {
          cartId = existingCart.id;
        } else {
          const { data: newCart, error: cartCreateError } = await supabase
            .from('b2c_carts')
            .insert({ user_id: buyerId, status: 'open' })
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

        await supabase.from('b2c_cart_items').insert(cartItems);
      }

      // 3. Cancel order
      const cancelledBy = user?.id === order.seller_id ? 'seller' : (user?.id === buyerId ? 'buyer' : 'admin');
      const { data, error } = await supabase
        .from('orders_b2b')
        .update({ 
          payment_status: 'cancelled',
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            cancelled_at: new Date().toISOString(),
            cancelled_by: cancelledBy,
            items_restored_to_cart: restoreToCart && buyerId && orderItems.length > 0,
          }
        })
        .eq('id', orderId)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return { ...data, itemsRestored: restoreToCart ? orderItems.length : 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['seller-b2c-sales'] });
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });
      toast({ 
        title: 'Pedido cancelado', 
        description: data.itemsRestored > 0 
          ? `${data.itemsRestored} productos restaurados al carrito del cliente.`
          : 'El pedido ha sido cancelado.'
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al cancelar pedido', description: error.message, variant: 'destructive' });
    },
  });

  // Get order stats
  const useOrderStats = (sellerId?: string) => {
    return useQuery({
      queryKey: ['order-stats', sellerId],
      queryFn: async () => {
        let query = supabase.from('orders_b2b').select('status, payment_status, total_amount, metadata');
        
        if (sellerId) {
          query = query.eq('seller_id', sellerId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const stats = {
          total: data.length,
          draft: data.filter(o => o.status === 'draft').length,
          placed: data.filter(o => o.status === 'placed').length,
          paid: data.filter(o => o.status === 'paid').length,
          shipped: data.filter(o => o.status === 'shipped').length,
          cancelled: data.filter(o => o.status === 'cancelled').length,
          pending_validation: data.filter(o => o.payment_status === 'pending_validation').length,
          totalAmount: data.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0),
          paidAmount: data.filter(o => o.status === 'paid' || o.status === 'shipped').reduce((sum, o) => sum + Number(o.total_amount), 0),
        };

        return stats;
      },
    });
  };

  // Get B2C sales stats for seller
  const useB2CSalesStats = () => {
    return useQuery({
      queryKey: ['b2c-sales-stats', user?.id],
      queryFn: async () => {
        if (!user?.id) return null;

        // Get seller's store first
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_user_id', user.id)
          .maybeSingle();

        if (!store?.id) return { total: 0, pending_validation: 0, paid: 0, shipped: 0, cancelled: 0, totalRevenue: 0 };
        
        const { data, error } = await supabase
          .from('orders_b2c')
          .select('status, payment_status, total_amount')
          .eq('store_id', store.id);
        
        if (error) throw error;

        return {
          total: data.length,
          pending_validation: data.filter(o => o.payment_status === 'pending_validation').length,
          paid: data.filter(o => o.status === 'paid' || o.payment_status === 'paid').length,
          shipped: data.filter(o => o.status === 'shipped').length,
          cancelled: data.filter(o => o.status === 'cancelled').length,
          totalRevenue: data.filter(o => o.status === 'paid' || o.status === 'shipped')
            .reduce((sum, o) => sum + Number(o.total_amount), 0),
        };
      },
      enabled: !!user?.id,
    });
  };

  // Update logistics stage for order
  const updateLogisticsStage = useMutation({
    mutationFn: async ({ 
      orderId, 
      logisticsStage,
      chinaTracking 
    }: { 
      orderId: string; 
      logisticsStage: string;
      chinaTracking?: string;
    }) => {
      // Get current order to preserve metadata
      const { data: currentOrder } = await supabase
        .from('orders_b2b')
        .select('metadata')
        .eq('id', orderId)
        .maybeSingle();
      
      const existingMetadata = (currentOrder?.metadata as Record<string, any>) || {};
      
      const { data, error } = await supabase
        .from('orders_b2b')
        .update({ 
          updated_at: new Date().toISOString(),
          metadata: {
            ...existingMetadata,
            logistics_stage: logisticsStage,
            stage_updated_at: new Date().toISOString(),
            ...(chinaTracking && { china_tracking: chinaTracking }),
            ...(logisticsStage === 'payment_validated' && { payment_confirmed_at: new Date().toISOString() }),
            ...(logisticsStage === 'in_china' && { shipped_from_china: true }),
            ...(logisticsStage === 'in_transit_usa' && { in_transit_usa: true }),
            ...(logisticsStage === 'in_haiti_hub' && { arrived_haiti: true }),
            ...(logisticsStage === 'ready_for_delivery' && { ready_for_delivery: true }),
          }
        })
        .eq('id', orderId)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Pedido no encontrado');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast({ title: 'Etapa logística actualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar etapa', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch paid orders for picking manifest (only payment_status = 'paid')
  const usePaidOrdersForManifest = (chinaTracking?: string) => {
    return useQuery({
      queryKey: ['paid-orders-manifest', chinaTracking],
      queryFn: async () => {
        let query = supabase
          .from('orders_b2b')
          .select(`
            *,
            profiles!orders_b2b_seller_id_fkey (full_name, email),
            buyer_profile:profiles!orders_b2b_buyer_id_fkey (full_name, email),
            order_items_b2b (*)
          `)
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: false });

        if (chinaTracking) {
          query = query.contains('metadata', { china_tracking: chinaTracking });
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Order[];
      },
    });
  };

  return {
    useSellerOrders,
    useSellerB2CSales,
    useAllOrders,
    useOrder,
    useOrderStats,
    useB2CSalesStats,
    usePaidOrdersForManifest,
    updateOrderStatus,
    updateOrderTracking,
    updateLogisticsStage,
    cancelOrder,
    cancelOrderWithRestore,
    confirmManualPayment,
    rejectManualPayment,
  };
};