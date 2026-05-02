import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

/** Active pickup point assignment for current user. */
export const useMyPickupPoint = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-pickup-point", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_point_managers")
        .select("*, pickup_points(*)")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

/** Orders routed to the manager's pickup point. */
export const usePickupOrders = (statusFilter?: string) => {
  const { data: assignment } = useMyPickupPoint();
  const qc = useQueryClient();
  const ppId = assignment?.pickup_point_id as string | undefined;

  const query = useQuery({
    queryKey: ["pickup-orders", ppId, statusFilter ?? "all"],
    enabled: !!ppId,
    queryFn: async () => {
      let q = supabase
        .from("orders_b2c")
        .select("*")
        .eq("pickup_point_id", ppId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter) q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ppId, qc]);

  return query;
};

export const useUpdatePickupOrderStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from("orders_b2c")
        .update({ status: vars.status as never, updated_at: new Date().toISOString() })
        .eq("id", vars.orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickup-orders"] });
      toast({ title: "Estado actualizado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};
