import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface MasterPurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  cycle_start_at: string;
  cycle_end_at: string | null;
  closed_at: string | null;
  china_tracking_number: string | null;
  china_tracking_entered_at: string | null;
  total_orders: number;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  shipped_from_china_at: string | null;
  arrived_usa_at: string | null;
  shipped_to_haiti_at: string | null;
  arrived_hub_at: string | null;
  created_by: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type POSourceType = 'b2b' | 'b2c' | 'siver_match';

export interface POOrderLink {
  id: string;
  po_id: string;
  order_id: string;
  order_type: 'b2b' | 'b2c' | 'siver_match';
  source_type: POSourceType;
  customer_user_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  department_code: string | null;
  commune_code: string | null;
  pickup_point_code: string | null;
  hybrid_tracking_id: string | null;
  short_order_id: string | null;
  unit_count: number;
  previous_status: string | null;
  current_status: string | null;
  status_synced_at: string | null;
  pickup_qr_code: string | null;
  pickup_qr_generated_at: string | null;
  delivery_confirmed_at: string | null;
  // Siver Match specific
  siver_match_sale_id: string | null;
  investor_user_id: string | null;
  gestor_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface POPickingItem {
  id: string;
  po_id: string;
  po_order_link_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  product_name: string;
  color: string | null;
  size: string | null;
  image_url: string | null;
  quantity: number;
  bin_location: string | null;
  picked_at: string | null;
  picked_by: string | null;
  created_at: string;
}

export interface POPickingManifest {
  po: MasterPurchaseOrder;
  customers: {
    customer_name: string;
    customer_phone: string | null;
    hybrid_tracking_id: string | null;
    department_code: string | null;
    commune_code: string | null;
    source_type: POSourceType;
    gestor_name?: string | null;
    investor_name?: string | null;
    items: POPickingItem[];
  }[];
}

export const usePurchaseOrders = () => {
  const queryClient = useQueryClient();

  // Fetch all POs
  const usePOList = () => useQuery({
    queryKey: ['master-purchase-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MasterPurchaseOrder[];
    },
  });

  // Fetch single PO with links
  const usePODetails = (poId: string) => useQuery({
    queryKey: ['po-details', poId],
    queryFn: async () => {
      const { data: po, error: poError } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();
      if (poError) throw poError;

      const { data: links, error: linksError } = await supabase
        .from('po_order_links')
        .select('*')
        .eq('po_id', poId)
        .order('customer_name');
      if (linksError) throw linksError;

      return { po: po as unknown as MasterPurchaseOrder, links: links as POOrderLink[] };
    },
    enabled: !!poId,
  });

  // Fetch PO picking items for manifest
  const usePOPickingItems = (poId: string) => useQuery({
    queryKey: ['po-picking-items', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_picking_items')
        .select('*')
        .eq('po_id', poId)
        .order('product_name');
      if (error) throw error;
      return data as unknown as POPickingItem[];
    },
    enabled: !!poId,
  });

  // Get current open PO or create new one
  const useCurrentOpenPO = () => useQuery({
    queryKey: ['current-open-po'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .in('status', ['draft', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MasterPurchaseOrder | null;
    },
  });

  // Create new PO
  const createPO = useMutation({
    mutationFn: async (notes?: string) => {
      const { data: poNumber } = await (supabase as any).rpc('generate_po_number');
      
      const { data, error } = await (supabase as any)
        .from('master_purchase_orders')
        .insert({
          po_number: poNumber || `PO${Date.now()}`,
          status: 'open',
          notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as MasterPurchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['current-open-po'] });
      toast.success('Nueva Orden de Compra creada');
    },
    onError: () => toast.error('Error al crear PO'),
  });

  // Link pending orders from ALL sources (B2B, B2C, Siver Match) to PO
  const linkOrdersToPO = useMutation({
    mutationFn: async (poId: string) => {
      const { data, error } = await (supabase as any).rpc('link_mixed_orders_to_po', { p_po_id: poId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-details'] });
      queryClient.invalidateQueries({ queryKey: ['current-open-po'] });
      const total = data?.total_linked || 0;
      const b2c = data?.b2c_linked || 0;
      const b2b = data?.b2b_linked || 0;
      const siver = data?.siver_match_linked || 0;
      toast.success(`${total} pedidos vinculados`, {
        description: `B2C: ${b2c} | B2B: ${b2b} | Siver Match: ${siver}`,
      });
    },
    onError: () => toast.error('Error al vincular pedidos'),
  });

  // Enter China tracking and generate hybrid IDs for ALL source types
  const enterChinaTracking = useMutation({
    mutationFn: async ({ poId, chinaTracking }: { poId: string; chinaTracking: string }) => {
      const { data, error } = await (supabase as any).rpc('process_mixed_po_china_tracking', {
        p_po_id: poId,
        p_china_tracking: chinaTracking,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-details'] });
      queryClient.invalidateQueries({ queryKey: ['po-order-links'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] }); // Refresh B2C customers
      queryClient.invalidateQueries({ queryKey: ['siver-match-sales'] }); // Refresh Siver Match
      const b2c = data?.b2c_updated || 0;
      const b2b = data?.b2b_updated || 0;
      const siver = data?.siver_match_updated || 0;
      toast.success(`Tracking registrado. ${data?.orders_updated || 0} pedidos actualizados.`, {
        description: `B2C: ${b2c} | B2B: ${b2b} | Siver Match: ${siver}`,
      });
    },
    onError: (error: any) => toast.error(error.message || 'Error al registrar tracking'),
  });

  // Update PO logistics stage for ALL source types (B2B, B2C, Siver Match)
  const updatePOStage = useMutation({
    mutationFn: async ({ poId, newStatus }: { poId: string; newStatus: string }) => {
      const { data, error } = await (supabase as any).rpc('update_mixed_po_logistics_stage', {
        p_po_id: poId,
        p_new_status: newStatus,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-details'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['siver-match-sales'] });
      queryClient.invalidateQueries({ queryKey: ['siver-match-my-lots'] });
      const b2c = data?.b2c_updated || 0;
      const b2b = data?.b2b_updated || 0;
      const siver = data?.siver_match_updated || 0;
      toast.success(`Estado actualizado a ${data?.new_status}`, {
        description: `B2C: ${b2c} | B2B: ${b2b} | Siver Match: ${siver} sincronizados`,
      });
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  // Generate pickup QR for confirmed payment orders
  const generatePickupQR = useMutation({
    mutationFn: async (orderLinkId: string) => {
      const { data, error } = await (supabase as any).rpc('generate_po_pickup_qr', {
        p_order_link_id: orderLinkId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-details'] });
      toast.success('Código QR generado');
    },
    onError: (error: any) => toast.error(error.message || 'Error al generar QR'),
  });

  // Close PO (no more orders can be linked)
  const closePO = useMutation({
    mutationFn: async (poId: string) => {
      const { error } = await supabase
        .from('master_purchase_orders')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          cycle_end_at: new Date().toISOString(),
        })
        .eq('id', poId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['current-open-po'] });
      toast.success('PO cerrada');
    },
    onError: () => toast.error('Error al cerrar PO'),
  });

  // Get picking manifest data for PDF - grouped by source type
  const getPickingManifest = async (poId: string): Promise<POPickingManifest | null> => {
    const { data: po, error: poError } = await supabase
      .from('master_purchase_orders')
      .select('*')
      .eq('id', poId)
      .single();
    
    if (poError || !po) return null;

    const { data: links } = await supabase
      .from('po_order_links')
      .select('*')
      .eq('po_id', poId)
      .order('source_type')
      .order('customer_name');

    const { data: items } = await supabase
      .from('po_picking_items')
      .select('*')
      .eq('po_id', poId);

    // For Siver Match, fetch gestor/investor names
    const siverLinks = links?.filter(l => l.source_type === 'siver_match') || [];
    const gestorIds = [...new Set(siverLinks.map(l => (l as any).gestor_user_id).filter(Boolean))];
    const investorIds = [...new Set(siverLinks.map(l => (l as any).investor_user_id).filter(Boolean))];
    
    let gestorNames: Record<string, string> = {};
    let investorNames: Record<string, string> = {};
    
    if (gestorIds.length > 0) {
      const { data: gestors } = await supabase
        .from('siver_match_profiles')
        .select('user_id, display_name')
        .in('user_id', gestorIds);
      gestors?.forEach(g => { gestorNames[g.user_id] = g.display_name; });
    }
    
    if (investorIds.length > 0) {
      const { data: investors } = await supabase
        .from('siver_match_profiles')
        .select('user_id, display_name')
        .in('user_id', investorIds);
      investors?.forEach(i => { investorNames[i.user_id] = i.display_name; });
    }

    // Group items by customer
    const customerMap = new Map<string, {
      customer_name: string;
      customer_phone: string | null;
      hybrid_tracking_id: string | null;
      department_code: string | null;
      commune_code: string | null;
      source_type: POSourceType;
      gestor_name?: string | null;
      investor_name?: string | null;
      items: POPickingItem[];
    }>();

    links?.forEach(link => {
      const customerItems = items?.filter(item => item.po_order_link_id === link.id) || [];
      const key = link.id;
      
      customerMap.set(key, {
        customer_name: link.customer_name || 'Sin nombre',
        customer_phone: link.customer_phone,
        hybrid_tracking_id: link.hybrid_tracking_id,
        department_code: link.department_code,
        commune_code: link.commune_code,
        source_type: (link.source_type as POSourceType) || 'b2c',
        gestor_name: (link as any).gestor_user_id ? gestorNames[(link as any).gestor_user_id] : null,
        investor_name: (link as any).investor_user_id ? investorNames[(link as any).investor_user_id] : null,
        items: customerItems as unknown as POPickingItem[],
      });
    });

    return {
      po: po as MasterPurchaseOrder,
      customers: Array.from(customerMap.values()),
    };
  };

  // Process wallet splits on delivery confirmation (Siver Match only)
  const processDeliveryWalletSplits = useMutation({
    mutationFn: async (poId: string) => {
      const { data, error } = await supabase.rpc('process_delivery_wallet_splits', { p_po_id: poId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-sales'] });
      queryClient.invalidateQueries({ queryKey: ['seller-wallets'] });
      toast.success(`${data?.splits_processed || 0} pagos liberados a wallets`);
    },
    onError: () => toast.error('Error al procesar pagos'),
  });

  return {
    usePOList,
    usePODetails,
    usePOPickingItems,
    useCurrentOpenPO,
    createPO,
    linkOrdersToPO,
    enterChinaTracking,
    updatePOStage,
    generatePickupQR,
    closePO,
    getPickingManifest,
    processDeliveryWalletSplits,
  };
};
