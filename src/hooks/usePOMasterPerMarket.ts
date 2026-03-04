/**
 * PO Master Per Market Hook
 * Manages perpetual PO cycle per destination market
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MarketPODashboardItem {
  market_id: string;
  market_name: string;
  market_code: string;
  active_po_id: string | null;
  active_po_number: string | null;
  cycle_start_at: string | null;
  total_orders: number;
  total_quantity: number;
  total_amount: number;
  china_tracking: string | null;
  close_mode: string | null;
  quantity_threshold: number | null;
  weight_threshold_kg: number | null;
  time_interval_hours: number | null;
  auto_close_enabled: boolean | null;
  closed_pos_count: number;
}

export interface POMarketSettings {
  id: string;
  market_id: string;
  auto_close_enabled: boolean;
  close_mode: string;
  close_cron_expression: string | null;
  quantity_threshold: number;
  weight_threshold_kg: number;
  time_interval_hours: number;
  is_active: boolean;
}

export function usePOMasterPerMarket() {
  const queryClient = useQueryClient();

  // Dashboard: all markets with their active POs
  const useDashboard = () => useQuery({
    queryKey: ['po-market-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_market_po_dashboard');
      if (error) throw error;
      return (data || []) as MarketPODashboardItem[];
    },
    refetchInterval: 30000,
  });

  // Orders in a specific PO
  const usePOOrders = (poId: string | null) => useQuery({
    queryKey: ['po-orders', poId],
    queryFn: async () => {
      if (!poId) return [];

      // Step 1: collect order IDs linked via po_order_links (any order_type)
      const { data: links } = await supabase
        .from('po_order_links')
        .select('order_id')
        .eq('po_id', poId);
      const linkedIds = (links || []).map((l: { order_id: string }) => l.order_id);

      // Step 2: query orders_b2b — try master_po_id, po_id (legacy), or po_order_links IDs
      let ordersQuery = supabase
        .from('orders_b2b')
        .select('*, buyer:profiles!orders_b2b_buyer_id_fkey(id, full_name, email)')
        .order('created_at', { ascending: true });

      if (linkedIds.length > 0) {
        ordersQuery = ordersQuery.or(
          `master_po_id.eq.${poId},po_id.eq.${poId},id.in.(${linkedIds.join(',')})`
        );
      } else {
        ordersQuery = ordersQuery.or(`master_po_id.eq.${poId},po_id.eq.${poId}`);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) return [];

      // Step 3: fetch items for these orders (simple query, no nested joins)
      const orderIds = orders.map((o: any) => o.id);
      const { data: items } = await supabase
        .from('order_items_b2b')
        .select('id, order_id, nombre, sku, cantidad, precio_unitario, precio_total, color, size, variant_id, product_id, variant_attributes, metadata, image')
        .in('order_id', orderIds);

      // Step 4: fetch products and variants
      const productIds = [...new Set((items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id))];
      const explicitVariantIds = [...new Set((items || []).filter((i: any) => i.variant_id).map((i: any) => i.variant_id))];
      // Items without image saved and without variant_id → look up by SKU
      const skusForImageLookup = [...new Set(
        (items || []).filter((i: any) => !i.image && !i.variant_id && i.sku).map((i: any) => i.sku as string)
      )];

      const [productsRes, variantsByIdRes, variantsBySkuRes] = await Promise.all([
        productIds.length > 0
          ? supabase.from('products').select('*').in('id', productIds as string[])
          : Promise.resolve({ data: [] }),
        explicitVariantIds.length > 0
          ? supabase.from('product_variants').select('*').in('id', explicitVariantIds as string[])
          : Promise.resolve({ data: [] }),
        skusForImageLookup.length > 0
          ? supabase.from('product_variants').select('id, sku, images, name, option_type, option_value').in('sku', skusForImageLookup)
          : Promise.resolve({ data: [] }),
      ]);

      const productMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));
      const variantByIdMap = new Map((variantsByIdRes.data || []).map((v: any) => [v.id, v]));
      const variantBySkuMap = new Map((variantsBySkuRes.data || []).map((v: any) => [v.sku, v]));

      // Step 5: attach enriched items to each order
      const itemsByOrder = new Map<string, any[]>();
      (items || []).forEach((item: any) => {
        const list = itemsByOrder.get(item.order_id) || [];
        // Resolve variant: by id first, then by SKU (only for image resolution)
        const variantById = item.variant_id ? (variantByIdMap.get(item.variant_id) ?? null) : null;
        const variantBySku = !variantById && item.sku ? (variantBySkuMap.get(item.sku) ?? null) : null;
        const variant = variantById ?? variantBySku ?? null;
        // Resolve image: saved on item → variant.images[0] → product.imagen_principal
        const variantImg = variant?.images
          ? (Array.isArray(variant.images) ? variant.images[0] : variant.images) ?? null
          : null;
        const productImg = productMap.get(item.product_id)?.imagen_principal ?? null;
        list.push({
          ...item,
          image: item.image || variantImg || productImg || null,
          product: productMap.get(item.product_id) ?? null,
          variant: variantById ?? variantBySku ?? null,
        });
        itemsByOrder.set(item.order_id, list);
      });

      return orders.map((o: any) => ({
        ...o,
        order_items_b2b: itemsByOrder.get(o.id) || [],
      }));
    },
    enabled: !!poId,
  });

  // Closed POs for a market
  const useClosedPOs = (marketId: string | null) => useQuery({
    queryKey: ['closed-pos', marketId],
    queryFn: async () => {
      if (!marketId) return [];
      const { data, error } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .eq('market_id', marketId)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!marketId,
  });

  // Market settings
  const useMarketSettings = (marketId: string | null) => useQuery({
    queryKey: ['po-market-settings', marketId],
    queryFn: async () => {
      if (!marketId) return null;
      const { data, error } = await supabase
        .from('po_market_settings')
        .select('*')
        .eq('market_id', marketId)
        .maybeSingle();
      if (error) throw error;
      return data as POMarketSettings | null;
    },
    enabled: !!marketId,
  });

  // Ensure active PO exists for market
  const ensureMarketPO = useMutation({
    mutationFn: async (marketId: string) => {
      const { data, error } = await supabase.rpc('get_or_create_market_po', {
        p_market_id: marketId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      if (data?.is_new) {
        toast.success(`Nueva PO creada: ${data.po_number}`);
      }
    },
    onError: () => toast.error('Error al crear PO'),
  });

  // Close PO and open next (perpetual cycle)
  const closePOAndOpenNext = useMutation({
    mutationFn: async ({ poId, reason }: { poId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('close_market_po_and_open_next', {
        p_po_id: poId,
        p_close_reason: reason || 'manual',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['po-orders'] });
      queryClient.invalidateQueries({ queryKey: ['closed-pos'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success(
        `PO ${data?.closed_po_number} cerrada → ${data?.orders_transitioned} pedidos en Preparación`,
        { description: `Nueva PO abierta automáticamente` }
      );
    },
    onError: () => toast.error('Error al cerrar PO'),
  });

  // Update China tracking
  const updateChinaTracking = useMutation({
    mutationFn: async ({ poId, tracking }: { poId: string; tracking: string }) => {
      const { data, error } = await supabase.rpc('update_po_china_tracking', {
        p_po_id: poId,
        p_china_tracking: tracking,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['po-orders'] });
      toast.success(`Tracking actualizado: ${data?.orders_updated} pedidos`);
    },
    onError: () => toast.error('Error al actualizar tracking'),
  });

  // Update/create market settings
  const updateMarketSettings = useMutation({
    mutationFn: async (settings: Partial<POMarketSettings> & { market_id: string }) => {
      const { data, error } = await supabase
        .from('po_market_settings')
        .upsert({
          market_id: settings.market_id,
          auto_close_enabled: settings.auto_close_enabled ?? false,
          close_mode: settings.close_mode ?? 'manual',
          close_cron_expression: settings.close_cron_expression ?? null,
          quantity_threshold: settings.quantity_threshold ?? 50,
          weight_threshold_kg: settings.weight_threshold_kg ?? 500,
          time_interval_hours: settings.time_interval_hours ?? 168,
          is_active: settings.is_active ?? true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'market_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-market-settings'] });
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      toast.success('Configuración de cierre actualizada');
    },
    onError: () => toast.error('Error al actualizar configuración'),
  });

  // Update PO logistics stage
  const updatePOStage = useMutation({
    mutationFn: async ({ poId, newStatus }: { poId: string; newStatus: string }) => {
      // Update all orders in this PO
      const { error } = await supabase
        .from('orders_b2b')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('master_po_id', poId);
      if (error) throw error;
      
      // Update PO status
      await supabase
        .from('master_purchase_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', poId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-market-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['po-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  return {
    useDashboard,
    usePOOrders,
    useClosedPOs,
    useMarketSettings,
    ensureMarketPO,
    closePOAndOpenNext,
    updateChinaTracking,
    updateMarketSettings,
    updatePOStage,
  };
}
