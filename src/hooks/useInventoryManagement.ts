import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface StockInTransit {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  china_tracking_number: string | null;
  supplier_id: string | null;
  expected_arrival_date: string | null;
  shipped_date: string | null;
  status: string;
  batch_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrderStockAllocation {
  id: string;
  order_id: string;
  order_type: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  quantity_ordered: number;
  quantity_from_haiti: number;
  quantity_from_transit: number;
  quantity_pending_purchase: number;
  allocation_status: string;
}

export interface StockRotationTracking {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  last_sale_date: string | null;
  stock_quantity: number;
  suggested_discount: number;
  alert_sent_at: string | null;
}

export interface PurchaseConsolidation {
  id: string;
  consolidation_number: string;
  status: string;
  total_items: number;
  total_quantity: number;
  estimated_cost: number;
  supplier_id: string | null;
  notes: string | null;
  submitted_at: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface ConsolidationItem {
  id: string;
  consolidation_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  product_name: string;
  color: string | null;
  size: string | null;
  quantity_confirmed: number;
  quantity_pending: number;
  quantity_cart: number;
  quantity_in_stock: number;
  quantity_in_transit: number;
  quantity_to_order: number;
  unit_cost: number;
  total_cost: number;
}

export interface StockBalance {
  product_id: string;
  product_name: string;
  sku: string;
  variant_id: string;
  variant_name: string;
  stock_haiti: number;
  stock_in_transit: number;
  orders_pending: number;
  available_balance: number;
}

export interface DemandSummary {
  sku: string;
  product_name: string;
  color: string | null;
  size: string | null;
  quantity_confirmed: number;
  quantity_pending: number;
  quantity_cart: number;
  total_demand: number;
  stock_available: number;
  quantity_to_order: number;
}

export const useInventoryManagement = () => {
  const queryClient = useQueryClient();

  // Fetch stock in transit
  const useStockInTransit = () => useQuery({
    queryKey: ['stock-in-transit'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('stock_in_transit')
        .select('*, products(nombre, sku_interno), product_variants(option_value), suppliers(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch stock balance view
  const useStockBalance = () => useQuery({
    queryKey: ['stock-balance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('stock_balance_view')
        .select('*')
        .order('product_name');
      if (error) throw error;
      return data as StockBalance[];
    },
  });

  // Fetch rotation alerts (30+ days without sale)
  const useRotationAlerts = () => useQuery({
    queryKey: ['rotation-alerts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('stock_rotation_alerts')
        .select('*')
        .order('days_without_sale', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchase consolidations
  const useConsolidations = () => useQuery({
    queryKey: ['purchase-consolidations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('purchase_consolidations')
        .select('*, suppliers(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch consolidation items
  const useConsolidationItems = (consolidationId: string) => useQuery({
    queryKey: ['consolidation-items', consolidationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('purchase_consolidation_items')
        .select('*')
        .eq('consolidation_id', consolidationId)
        .order('product_name');
      if (error) throw error;
      return data as ConsolidationItem[];
    },
    enabled: !!consolidationId,
  });

  // Calculate demand summary from orders and carts
  const useDemandSummary = () => useQuery({
    queryKey: ['demand-summary'],
    queryFn: async () => {
      // Get confirmed orders (paid)
      const { data: confirmedOrders } = await supabase
        .from('order_items_b2b')
        .select('sku, nombre, cantidad, orders_b2b!inner(payment_status)')
        .eq('orders_b2b.payment_status', 'paid');

      // Get pending orders
      const { data: pendingOrders } = await supabase
        .from('order_items_b2b')
        .select('sku, nombre, cantidad, orders_b2b!inner(payment_status)')
        .in('orders_b2b.payment_status', ['pending', 'pending_validation']);

      // Get cart items (potential demand)
      const { data: cartItems } = await supabase
        .from('b2b_cart_items')
        .select('sku, nombre, quantity, b2b_carts!inner(status)')
        .eq('b2b_carts.status', 'open');

      // Get current stock
      const { data: variants } = await supabase
        .from('product_variants')
        .select('sku, stock, option_value, attribute_combination');

      // Aggregate by SKU
      const demandMap = new Map<string, DemandSummary>();

      // Process confirmed orders
      confirmedOrders?.forEach(item => {
        const existing = demandMap.get(item.sku) || {
          sku: item.sku,
          product_name: item.nombre,
          color: null,
          size: null,
          quantity_confirmed: 0,
          quantity_pending: 0,
          quantity_cart: 0,
          total_demand: 0,
          stock_available: 0,
          quantity_to_order: 0,
        };
        existing.quantity_confirmed += item.cantidad;
        demandMap.set(item.sku, existing);
      });

      // Process pending orders
      pendingOrders?.forEach(item => {
        const existing = demandMap.get(item.sku) || {
          sku: item.sku,
          product_name: item.nombre,
          color: null,
          size: null,
          quantity_confirmed: 0,
          quantity_pending: 0,
          quantity_cart: 0,
          total_demand: 0,
          stock_available: 0,
          quantity_to_order: 0,
        };
        existing.quantity_pending += item.cantidad;
        demandMap.set(item.sku, existing);
      });

      // Process cart items
      cartItems?.forEach(item => {
        const existing = demandMap.get(item.sku) || {
          sku: item.sku,
          product_name: item.nombre,
          color: null,
          size: null,
          quantity_confirmed: 0,
          quantity_pending: 0,
          quantity_cart: 0,
          total_demand: 0,
          stock_available: 0,
          quantity_to_order: 0,
        };
        existing.quantity_cart += item.quantity;
        demandMap.set(item.sku, existing);
      });

      // Add stock info and calculate totals
      variants?.forEach(v => {
        const existing = demandMap.get(v.sku);
        if (existing) {
          existing.stock_available = v.stock || 0;
          const attrs = v.attribute_combination as Record<string, string> | null;
          existing.color = attrs?.color || null;
          existing.size = attrs?.size || null;
        }
      });

      // Calculate totals
      demandMap.forEach((item, sku) => {
        item.total_demand = item.quantity_confirmed + item.quantity_pending + item.quantity_cart;
        item.quantity_to_order = Math.max(0, item.total_demand - item.stock_available);
        demandMap.set(sku, item);
      });

      return Array.from(demandMap.values()).filter(d => d.total_demand > 0);
    },
  });

  // Create stock in transit
  const createStockInTransit = useMutation({
    mutationFn: async (data: Omit<StockInTransit, 'id' | 'created_at'>) => {
      const { error } = await (supabase as any).from('stock_in_transit').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-in-transit'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balance'] });
      toast.success('Stock en tránsito registrado');
    },
    onError: () => toast.error('Error al registrar stock'),
  });

  // Update stock in transit status
  const updateTransitStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from('stock_in_transit')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-in-transit'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balance'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  // Create consolidation
  const createConsolidation = useMutation({
    mutationFn: async (data: { supplier_id?: string; notes?: string; items: Omit<ConsolidationItem, 'id' | 'consolidation_id'>[] }) => {
      // Generate consolidation number
      const { data: numData } = await (supabase.rpc as any)('generate_consolidation_number');
      const consolidationNumber = numData || `CON-${Date.now()}`;

      // Create consolidation
      const { data: consolidation, error: consError } = await supabase
        .from('purchase_consolidations')
        .insert({
          consolidation_number: consolidationNumber,
          supplier_id: data.supplier_id,
          notes: data.notes,
          total_items: data.items.length,
          total_quantity: data.items.reduce((sum, i) => sum + i.quantity_to_order, 0),
          estimated_cost: data.items.reduce((sum, i) => sum + i.total_cost, 0),
        })
        .select()
        .single();

      if (consError) throw consError;

      // Create items
      const itemsToInsert = data.items.map(item => ({
        ...item,
        consolidation_id: consolidation.id,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_consolidation_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return consolidation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-consolidations'] });
      toast.success('Consolidación creada');
    },
    onError: () => toast.error('Error al crear consolidación'),
  });

  // Update consolidation status
  const updateConsolidationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
      
      if (status === 'submitted') updates.submitted_at = new Date().toISOString();
      if (status === 'ordered') updates.ordered_at = new Date().toISOString();
      if (status === 'received') updates.received_at = new Date().toISOString();

      const { error } = await supabase
        .from('purchase_consolidations')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-consolidations'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  // Allocate stock to order
  const allocateStockToOrder = useMutation({
    mutationFn: async (allocation: Omit<OrderStockAllocation, 'id'>) => {
      // Calculate allocation based on availability
      const { data: balance } = await supabase
        .from('stock_balance_view')
        .select('stock_haiti, stock_in_transit')
        .eq('variant_id', allocation.variant_id)
        .single();

      const stockHaiti = balance?.stock_haiti || 0;
      const stockTransit = balance?.stock_in_transit || 0;
      let remaining = allocation.quantity_ordered;

      // Allocate from Haiti first
      const fromHaiti = Math.min(remaining, stockHaiti);
      remaining -= fromHaiti;

      // Then from transit
      const fromTransit = Math.min(remaining, stockTransit);
      remaining -= fromTransit;

      // Rest is pending purchase
      const pendingPurchase = remaining;

      const { error } = await supabase
        .from('order_stock_allocations')
        .insert({
          ...allocation,
          quantity_from_haiti: fromHaiti,
          quantity_from_transit: fromTransit,
          quantity_pending_purchase: pendingPurchase,
          allocation_status: pendingPurchase > 0 ? 'partial' : 'allocated',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-balance'] });
      toast.success('Stock asignado');
    },
    onError: () => toast.error('Error al asignar stock'),
  });

  return {
    useStockInTransit,
    useStockBalance,
    useRotationAlerts,
    useConsolidations,
    useConsolidationItems,
    useDemandSummary,
    createStockInTransit,
    updateTransitStatus,
    createConsolidation,
    updateConsolidationStatus,
    allocateStockToOrder,
  };
};
