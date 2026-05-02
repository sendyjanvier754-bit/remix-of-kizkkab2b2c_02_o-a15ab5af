import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

/** Current driver row for the logged-in user (may be null while pending) */
export const useMyDriverProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-driver-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

/** Routes available to accept (Uber-style pool). */
export const useAvailableRoutes = () => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["driver-available-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_routes")
        .select("*")
        .eq("status", "available")
        .is("driver_id", null)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime invalidation
  useEffect(() => {
    const ch = supabase
      .channel("driver-available-routes")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_routes" }, () => {
        qc.invalidateQueries({ queryKey: ["driver-available-routes"] });
        qc.invalidateQueries({ queryKey: ["driver-my-routes"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
};

/** Routes assigned to the current driver. */
export const useMyRoutes = () => {
  const { data: driver } = useMyDriverProfile();
  return useQuery({
    queryKey: ["driver-my-routes", driver?.id],
    enabled: !!driver?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_routes")
        .select("*")
        .eq("driver_id", driver!.id)
        .order("scheduled_for", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useRouteDetail = (routeId: string | null) => {
  const route = useQuery({
    queryKey: ["driver-route", routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_routes")
        .select("*")
        .eq("id", routeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const stops = useQuery({
    queryKey: ["driver-route-stops", routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("*")
        .eq("route_id", routeId!)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  return { route, stops };
};

export const useAcceptRoute = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (routeId: string) => {
      const { data, error } = await supabase.rpc("accept_delivery_route", { p_route_id: routeId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-available-routes"] });
      qc.invalidateQueries({ queryKey: ["driver-my-routes"] });
      toast({ title: "Ruta aceptada", description: "Ya puedes comenzar la entrega." });
    },
    onError: (e: Error) => toast({ title: "No disponible", description: e.message, variant: "destructive" }),
  });
};

export const useCompleteStop = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { stopId: string; proofUrl?: string; notes?: string }) => {
      const { error } = await supabase.rpc("complete_route_stop", {
        p_stop_id: vars.stopId,
        p_proof_url: vars.proofUrl ?? null,
        p_notes: vars.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-route-stops"] });
      qc.invalidateQueries({ queryKey: ["driver-my-routes"] });
      toast({ title: "Parada completada" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useMyEarnings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["partner-earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_earnings")
        .select("*")
        .eq("partner_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
};
