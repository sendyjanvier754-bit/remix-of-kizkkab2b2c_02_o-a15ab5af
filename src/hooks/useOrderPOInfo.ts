import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderPOInfo {
  po_id: string;
  po_number: string;
  po_status: string;
  hybrid_tracking_id: string | null;
  short_order_id: string | null;
  current_status: string | null;
  pickup_point_code: string | null;
  delivery_confirmed_at: string | null;
  // PO logistics timestamps
  shipped_from_china_at: string | null;
  arrived_usa_at: string | null;
  shipped_to_haiti_at: string | null;
  arrived_hub_at: string | null;
  china_tracking_number: string | null;
}

export const useOrderPOInfo = (orderId: string | undefined) => {
  return useQuery({
    queryKey: ['order-po-info', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      // Get the po_order_link for this order along with PO info
      const { data: link, error: linkError } = await supabase
        .from('po_order_links')
        .select(`
          id,
          po_id,
          hybrid_tracking_id,
          short_order_id,
          current_status,
          pickup_point_code,
          delivery_confirmed_at
        `)
        .eq('order_id', orderId)
        .maybeSingle();

      if (linkError) throw linkError;
      if (!link) return null;

      // Get the PO details
      const { data: po, error: poError } = await (supabase as any)
        .from('master_purchase_orders')
        .select(`
          id,
          po_number,
          status,
          china_tracking_number,
          shipped_from_china_at,
          arrived_usa_at,
          shipped_to_haiti_at,
          arrived_hub_at
        `)
        .eq('id', (link as any).po_id)
        .single();

      if (poError) throw poError;

      return {
        po_id: po.id,
        po_number: po.po_number,
        po_status: po.status,
        hybrid_tracking_id: link.hybrid_tracking_id,
        short_order_id: link.short_order_id,
        current_status: link.current_status,
        pickup_point_code: link.pickup_point_code,
        delivery_confirmed_at: link.delivery_confirmed_at,
        shipped_from_china_at: po.shipped_from_china_at,
        arrived_usa_at: po.arrived_usa_at,
        shipped_to_haiti_at: po.shipped_to_haiti_at,
        arrived_hub_at: po.arrived_hub_at,
        china_tracking_number: po.china_tracking_number,
      } as OrderPOInfo;
    },
    enabled: !!orderId,
  });
};

// Hook to get PO info for multiple orders at once
export const useOrdersPOInfo = (orderIds: string[]) => {
  return useQuery({
    queryKey: ['orders-po-info', orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return {};

      // Get all po_order_links for these orders
      const { data: links, error: linksError } = await supabase
        .from('po_order_links')
        .select(`
          id,
          order_id,
          po_id,
          hybrid_tracking_id,
          short_order_id,
          current_status,
          pickup_point_code,
          delivery_confirmed_at
        `)
        .in('order_id', orderIds);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return {};

      // Get unique PO IDs
      const poIds = [...new Set(links.map(l => l.po_id))];

      // Get PO details
      const { data: pos, error: posError } = await supabase
        .from('master_purchase_orders')
        .select(`
          id,
          po_number,
          status,
          china_tracking_number,
          shipped_from_china_at,
          arrived_usa_at,
          shipped_to_haiti_at,
          arrived_hub_at
        `)
        .in('id', poIds);

      if (posError) throw posError;

      // Create a map of PO info by order ID
      const poMap = new Map(pos?.map(po => [po.id, po]) || []);
      const result: Record<string, OrderPOInfo> = {};

      for (const link of links) {
        const po = poMap.get(link.po_id);
        if (po) {
          result[link.order_id] = {
            po_id: po.id,
            po_number: po.po_number,
            po_status: po.status,
            hybrid_tracking_id: link.hybrid_tracking_id,
            short_order_id: link.short_order_id,
            current_status: link.current_status,
            pickup_point_code: link.pickup_point_code,
            delivery_confirmed_at: link.delivery_confirmed_at,
            shipped_from_china_at: po.shipped_from_china_at,
            arrived_usa_at: po.arrived_usa_at,
            shipped_to_haiti_at: po.shipped_to_haiti_at,
            arrived_hub_at: po.arrived_hub_at,
            china_tracking_number: po.china_tracking_number,
          };
        }
      }

      return result;
    },
    enabled: orderIds.length > 0,
  });
};
