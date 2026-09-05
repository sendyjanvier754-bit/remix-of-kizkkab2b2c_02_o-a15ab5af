import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface HubBoxItem {
  id: string;
  box_id: string;
  order_id: string | null;
  order_type: string;
  order_number: string | null;
  tracking_id: string | null;
  buyer_user_id: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  seller_name: string | null;
  store_id: string | null;
  sku: string | null;
  product_name: string | null;
  quantity: number;
  unit_weight_grams: number;
  pickup_point_id: string | null;
  shipping_address: Record<string, unknown> | null;
}

export interface HubBox {
  id: string;
  internal_tracking_id: string;
  china_tracking_id: string | null;
  po_id: string | null;
  shipment_id: string | null;
  route_id: string | null;
  origin_country: string | null;
  hub_code: string | null;
  status: string;
  total_weight_kg: number;
  items_count: number;
  received_at: string | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
}

const weightFromRow = (row: Record<string, number | null> | null | undefined): number => {
  if (!row) return 0;
  const grams = row.peso_g ?? row.weight_g;
  if (grams) return Number(grams);
  const kg = row.peso_kg ?? row.weight_kg;
  if (kg) return Number(kg) * 1000;
  return 0;
};

export const useHubBoxes = (statusFilter?: string) => {
  return useQuery({
    queryKey: ["hub-boxes", statusFilter ?? "all"],
    queryFn: async (): Promise<HubBox[]> => {
      let query = supabase.from("hub_boxes").select("*").order("created_at", { ascending: false }).limit(100);
      if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as HubBox[];
    },
  });
};

export const useHubBoxItems = (boxId?: string) => {
  return useQuery({
    queryKey: ["hub-box-items", boxId],
    enabled: !!boxId,
    queryFn: async (): Promise<HubBoxItem[]> => {
      const { data, error } = await supabase
        .from("hub_box_items")
        .select("*")
        .eq("box_id", boxId!)
        .order("order_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as HubBoxItem[];
    },
  });
};

/**
 * Scan/receive a box in the Central Hub: finds an existing box by internal tracking ID
 * or builds it from the linked PO shipment / China tracking, exploding its content.
 */
export const useReceiveBox = () => {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ trackingId, originCountry }: { trackingId: string; originCountry?: string }) => {
      const code = trackingId.trim();
      if (!code) throw new Error("Ingresa un ID de rastreo");

      const { data: existing } = await supabase
        .from("hub_boxes")
        .select("*")
        .or(`internal_tracking_id.eq.${code},china_tracking_id.eq.${code}`)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("hub_boxes")
          .update({ status: "received", received_at: new Date().toISOString() })
          .eq("id", existing.id);
        return existing.id as string;
      }

      // Resolve the shipment / PO behind this tracking code
      const { data: shipment } = await supabase
        .from("po_shipments")
        .select("id, po_id, international_tracking, billable_weight_kg, actual_weight_kg")
        .or(`international_tracking.eq.${code},shipment_number.eq.${code}`)
        .maybeSingle();

      let poId = shipment?.po_id ?? null;
      let chinaTracking = shipment?.international_tracking ?? null;

      if (!poId) {
        const { data: po } = await supabase
          .from("master_purchase_orders")
          .select("id, china_tracking, transit_tracking, po_number, hub_code")
          .or(`china_tracking.eq.${code},transit_tracking.eq.${code},po_number.eq.${code}`)
          .maybeSingle();
        if (!po) throw new Error("No se encontró ninguna caja, envío ni PO con ese ID de rastreo");
        poId = po.id;
        chinaTracking = po.china_tracking;
      }

      const { data: box, error: boxErr } = await supabase
        .from("hub_boxes")
        .insert({
          internal_tracking_id: code,
          china_tracking_id: chinaTracking,
          po_id: poId,
          shipment_id: shipment?.id ?? null,
          origin_country: originCountry ?? null,
          status: "received",
          received_at: new Date().toISOString(),
          total_weight_kg: Number(shipment?.billable_weight_kg ?? shipment?.actual_weight_kg ?? 0),
        })
        .select("id")
        .single();
      if (boxErr) throw boxErr;

      // Explode content: orders linked to the PO
      const { data: links } = await supabase
        .from("po_order_links")
        .select("order_id, order_type, customer_name, customer_phone, customer_user_id, short_order_id, hybrid_tracking_id, pickup_point_code")
        .eq("po_id", poId);

      const b2cIds = (links ?? []).filter((l) => l.order_type !== "b2b").map((l) => l.order_id).filter(Boolean) as string[];
      let totalWeight = 0;

      if (b2cIds.length) {
        const [{ data: orders }, { data: items }] = await Promise.all([
          supabase.from("orders_b2c").select("id, order_number, buyer_user_id, pickup_point_id, shipping_address, tracking_number, store_id").in("id", b2cIds),
          supabase.from("order_items_b2c").select("order_id, sku, product_name, quantity").in("order_id", b2cIds),
        ]);

        const skus = Array.from(new Set((items ?? []).map((i) => i.sku).filter(Boolean))) as string[];
        const weightBySku = new Map<string, number>();
        if (skus.length) {
          const [{ data: variants }, { data: products }] = await Promise.all([
            supabase.from("product_variants").select("sku, peso_g, weight_g, peso_kg, weight_kg").in("sku", skus),
            supabase.from("products").select("sku_interno, peso_g, weight_g, peso_kg, weight_kg").in("sku_interno", skus),
          ]);
          (products ?? []).forEach((p) => weightBySku.set(p.sku_interno as string, weightFromRow(p as never)));
          (variants ?? []).forEach((v) => weightBySku.set(v.sku as string, weightFromRow(v as never)));
        }

        const rows = (items ?? []).map((item) => {
          const order = (orders ?? []).find((o) => o.id === item.order_id);
          const link = (links ?? []).find((l) => l.order_id === item.order_id);
          const unitWeight = weightBySku.get(item.sku ?? "") ?? 0;
          totalWeight += (unitWeight * (item.quantity ?? 1)) / 1000;
          return {
            box_id: box.id,
            order_id: item.order_id,
            order_type: "b2c",
            order_number: order?.order_number ?? link?.short_order_id ?? null,
            tracking_id: link?.hybrid_tracking_id ?? order?.tracking_number ?? null,
            buyer_user_id: order?.buyer_user_id ?? link?.customer_user_id ?? null,
            buyer_name: link?.customer_name ?? null,
            buyer_phone: link?.customer_phone ?? null,
            store_id: order?.store_id ?? null,
            sku: item.sku,
            product_name: item.product_name,
            quantity: item.quantity ?? 1,
            unit_weight_grams: unitWeight,
            pickup_point_id: order?.pickup_point_id ?? null,
            shipping_address: order?.shipping_address ?? null,
          };
        });

        if (rows.length) {
          const { error: itemsErr } = await supabase.from("hub_box_items").insert(rows);
          if (itemsErr) throw itemsErr;
        }

        await supabase
          .from("hub_boxes")
          .update({ items_count: rows.length, total_weight_kg: Number(totalWeight.toFixed(3)) })
          .eq("id", box.id);
      }

      return box.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-boxes"] });
      toast({ title: "Caja recibida en el Hub Central" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};

/** Marks the box as processed and moves every linked order to "preparing" in the Master PO flow. */
export const useProcessBox = () => {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (boxId: string) => {
      const { data: items } = await supabase.from("hub_box_items").select("order_id, tracking_id").eq("box_id", boxId);
      const orderIds = Array.from(new Set((items ?? []).map((i) => i.order_id).filter(Boolean))) as string[];

      if (orderIds.length) {
        await supabase.from("orders_b2c").update({ status: "preparing" }).in("id", orderIds);
        await supabase.from("po_order_links").update({ current_status: "preparing" }).in("order_id", orderIds);
        await supabase.from("package_tracking_events").insert(
          (items ?? [])
            .filter((i) => i.tracking_id)
            .map((i) => ({
              tracking_id: i.tracking_id as string,
              order_id: i.order_id,
              order_type: "b2c",
              status: "preparing",
              note: "Procesado en Hub Central",
            })),
        );
      }

      const { error } = await supabase
        .from("hub_boxes")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", boxId);
      if (error) throw error;
      return orderIds.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["hub-boxes"] });
      qc.invalidateQueries({ queryKey: ["hub-box-items"] });
      toast({ title: "Caja procesada", description: `${count} pedidos actualizados a "preparing"` });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};

export interface TrackingLookup {
  tracking_id: string;
  order_id: string | null;
  order_number: string | null;
  status: string;
  payment_status: string | null;
  delivery_method: string | null;
  pickup_point: { name: string; address: string | null; phone: string | null } | null;
  shipping_address: Record<string, unknown> | null;
  eta: string | null;
  events: Array<{ status: string; note: string | null; eta: string | null; location: string | null; created_at: string }>;
}

export const useTrackingLookup = (trackingId?: string) => {
  return useQuery({
    queryKey: ["tracking-lookup", trackingId],
    enabled: !!trackingId,
    queryFn: async (): Promise<TrackingLookup | null> => {
      const code = (trackingId ?? "").trim();
      if (!code) return null;

      const { data: item } = await supabase
        .from("hub_box_items")
        .select("order_id, order_number, tracking_id")
        .or(`tracking_id.eq.${code},order_number.eq.${code}`)
        .maybeSingle();

      let orderId = item?.order_id ?? null;
      if (!orderId) {
        const { data: order } = await supabase
          .from("orders_b2c")
          .select("id")
          .or(`tracking_number.eq.${code},order_number.eq.${code}`)
          .maybeSingle();
        orderId = order?.id ?? null;
      }
      if (!orderId) return null;

      const [{ data: order }, { data: delivery }, { data: events }] = await Promise.all([
        supabase
          .from("orders_b2c")
          .select("id, order_number, status, payment_status, delivery_method, shipping_address, pickup_point_id, estimated_delivery_date, tracking_number")
          .eq("id", orderId)
          .maybeSingle(),
        supabase.from("order_deliveries").select("status, delivery_code, ready_at").eq("order_id", orderId).maybeSingle(),
        supabase.from("package_tracking_events").select("status, note, eta, location, created_at").eq("order_id", orderId).order("created_at", { ascending: false }),
      ]);

      let pickupPoint: TrackingLookup["pickup_point"] = null;
      if (order?.pickup_point_id) {
        const { data: pp } = await supabase.from("pickup_points").select("name, address, phone").eq("id", order.pickup_point_id).maybeSingle();
        pickupPoint = pp ?? null;
      }

      return {
        tracking_id: item?.tracking_id ?? order?.tracking_number ?? code,
        order_id: orderId,
        order_number: order?.order_number ?? item?.order_number ?? null,
        status: delivery?.status ?? order?.status ?? "unknown",
        payment_status: order?.payment_status ?? null,
        delivery_method: order?.delivery_method ?? null,
        pickup_point: pickupPoint,
        shipping_address: (order?.shipping_address as Record<string, unknown>) ?? null,
        eta: (events ?? []).find((e) => e.eta)?.eta ?? order?.estimated_delivery_date ?? null,
        events: (events ?? []) as TrackingLookup["events"],
      };
    },
  });
};

export const useUpdatePackageStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      trackingId,
      orderId,
      status,
      eta,
      note,
    }: { trackingId: string; orderId: string; status: string; eta?: string | null; note?: string }) => {
      const { error } = await supabase.from("package_tracking_events").insert({
        tracking_id: trackingId,
        order_id: orderId,
        order_type: "b2c",
        status,
        eta: eta || null,
        note: note || null,
      });
      if (error) throw error;

      if (status === "ready_for_pickup") {
        await supabase.from("orders_b2c").update({ status: "ready_for_pickup" }).eq("id", orderId);
        await supabase
          .from("order_deliveries")
          .update({ status: "ready", ready_at: new Date().toISOString() })
          .eq("order_id", orderId);
        await notifyCustomerReady(orderId, trackingId);
      } else {
        await supabase.from("orders_b2c").update({ status }).eq("id", orderId);
      }

      if (eta) {
        await supabase.from("orders_b2c").update({ estimated_delivery_date: eta }).eq("id", orderId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracking-lookup"] });
      toast({ title: "Estado actualizado" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};
