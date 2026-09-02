import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PickupOrder {
  id: string;
  order_number: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  subtotal: number | null;
  shipping_cost: number | null;
  total_amount: number | null;
  currency: string | null;
  shipping_address: Record<string, any> | null;
  delivery_method: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    product_name: string;
    sku: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    variant_info: any;
  }>;
  delivery: {
    id: string;
    delivery_code: string | null;
    security_pin: string | null;
    customer_qr_code: string | null;
    status: string | null;
    ready_at: string | null;
    confirmed_at: string | null;
    notes: string | null;
  } | null;
}

/** Active pickup point assignment for current user. */
export const useMyPickupPoint = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-pickup-point", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("pickup_point_managers")
        .select("*, pickup_points(*)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

/** Orders routed to the manager's pickup point, with package and delivery details. */
export const usePickupOrders = (statusFilter?: string) => {
  const { data: assignment } = useMyPickupPoint();
  const qc = useQueryClient();
  const ppId = assignment?.pickup_point_id as string | undefined;

  const query = useQuery({
    queryKey: ["pickup-orders", ppId, statusFilter ?? "all"],
    enabled: !!ppId,
    queryFn: async (): Promise<PickupOrder[]> => {
      if (!ppId) return [];
      let orderQuery = supabase
        .from("orders_b2c")
        .select("*")
        .eq("pickup_point_id", ppId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter) orderQuery = orderQuery.eq("status", statusFilter);

      const { data: orders, error: orderError } = await orderQuery;
      if (orderError) throw orderError;
      if (!orders?.length) return [];

      const orderIds = orders.map((order) => order.id);
      const [{ data: items, error: itemsError }, { data: deliveries, error: deliveriesError }] = await Promise.all([
        supabase.from("order_items_b2c").select("id, order_id, product_name, sku, quantity, unit_price, total_price, variant_info").in("order_id", orderIds),
        supabase.from("order_deliveries").select("id, order_id, delivery_code, security_pin, customer_qr_code, status, ready_at, confirmed_at, notes").in("order_id", orderIds).eq("pickup_point_id", ppId),
      ]);
      if (itemsError) throw itemsError;
      if (deliveriesError) throw deliveriesError;

      return orders.map((order) => ({
        ...order,
        items: (items ?? []).filter((item) => item.order_id === order.id),
        delivery: deliveries?.find((delivery) => delivery.order_id === order.id) ?? null,
      })) as PickupOrder[];
    },
  });

  useEffect(() => {
    if (!ppId) return;
    const ch = supabase
      .channel(`pickup-orders-${ppId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders_b2c", filter: `pickup_point_id=eq.${ppId}` },
        () => qc.invalidateQueries({ queryKey: ["pickup-orders"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_deliveries", filter: `pickup_point_id=eq.${ppId}` },
        () => qc.invalidateQueries({ queryKey: ["pickup-orders"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ppId, qc]);

  return query;
};

export const useUpdatePickupOrderStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { orderId: string; status: string; deliveryId?: string | null }) => {
      const orderUpdate = supabase
        .from("orders_b2c")
        .update({ status: vars.status, updated_at: new Date().toISOString() })
        .eq("id", vars.orderId);
      const deliveryStatus = vars.status === "ready_for_pickup" ? "ready" : vars.status === "delivered" ? "picked_up" : null;
      const deliveryUpdate = vars.deliveryId && deliveryStatus
        ? supabase.from("order_deliveries").update({ status: deliveryStatus, ...(deliveryStatus === "ready" ? { ready_at: new Date().toISOString() } : {}) }).eq("id", vars.deliveryId)
        : Promise.resolve({ error: null });
      const [{ error: orderError }, { error: deliveryError }] = await Promise.all([orderUpdate, deliveryUpdate]);
      if (orderError) throw orderError;
      if (deliveryError) throw deliveryError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickup-orders"] });
      toast({ title: "Estado actualizado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};
