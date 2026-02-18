import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TransitHub {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DestinationCountry {
  id: string;
  name: string;
  code: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShippingRoute {
  id: string;
  destination_country_id: string;
  transit_hub_id: string | null;
  is_direct: boolean;
  is_active: boolean;
  route_name: string | null;
  origin_country: string | null;
  destination_country: string | null;
  created_at: string;
  updated_at: string;
  destination_country_info?: DestinationCountry;
  transit_hub?: TransitHub;
}

export interface RouteLogisticsCost {
  id: string;
  shipping_route_id: string;
  segment: string;
  transport_type: 'maritimo' | 'aereo' | 'terrestre';
  cost_per_kg: number;
  cost_per_cbm: number;
  min_cost: number;
  estimated_days_min: number;
  estimated_days_max: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCountriesRoutes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch transit hubs
  const { data: transitHubs, isLoading: loadingHubs } = useQuery({
    queryKey: ["transit-hubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transit_hubs")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TransitHub[];
    },
  });

  // Fetch destination countries
  const { data: countries, isLoading: loadingCountries } = useQuery({
    queryKey: ["destination-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("destination_countries")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as DestinationCountry[];
    },
  });

  // Fetch shipping routes with relations
  const { data: routes, isLoading: loadingRoutes } = useQuery({
    queryKey: ["shipping-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_routes")
        .select(`
          *,
          destination_country_info:destination_countries(*),
          transit_hub:transit_hubs(*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ShippingRoute[];
    },
  });

  // Fetch route logistics costs
  const { data: logisticsCosts, isLoading: loadingCosts } = useQuery({
    queryKey: ["route-logistics-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_logistics_costs")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as RouteLogisticsCost[];
    },
  });

  // ========== MUTATIONS ==========

  // Create transit hub
  const createHub = useMutation({
    mutationFn: async (hub: { name: string; code: string; description?: string | null; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("transit_hubs")
        .insert([hub])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transit-hubs"] });
      toast({ title: "Hub de tránsito creado exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear hub", description: error.message, variant: "destructive" });
    },
  });

  // Update transit hub
  const updateHub = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; code?: string; description?: string | null; is_active?: boolean }) => {
      const { error } = await supabase
        .from("transit_hubs")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transit-hubs"] });
      toast({ title: "Hub actualizado exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar hub", description: error.message, variant: "destructive" });
    },
  });

  // Create destination country
  const createCountry = useMutation({
    mutationFn: async (country: { name: string; code: string; currency: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("destination_countries")
        .insert([country])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["destination-countries"] });
      toast({ title: "País destino creado exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear país", description: error.message, variant: "destructive" });
    },
  });

  // Update destination country
  const updateCountry = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; code?: string; currency?: string; is_active?: boolean }) => {
      const { error } = await supabase
        .from("destination_countries")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["destination-countries"] });
      toast({ title: "País actualizado exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar país", description: error.message, variant: "destructive" });
    },
  });

  // Create shipping route
  const createRoute = useMutation({
    mutationFn: async (route: { destination_country_id: string; transit_hub_id: string | null; is_direct: boolean; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("shipping_routes")
        .insert([route])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-routes"] });
      queryClient.invalidateQueries({ queryKey: ["shipping_tiers_all"] });
      toast({ title: "Ruta creada exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear ruta", description: error.message, variant: "destructive" });
    },
  });

  // Update shipping route
  const updateRoute = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; destination_country_id?: string; transit_hub_id?: string | null; is_direct?: boolean; is_active?: boolean }) => {
      const { error } = await supabase
        .from("shipping_routes")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-routes"] });
      queryClient.invalidateQueries({ queryKey: ["shipping_tiers_all"] });
      toast({ title: "Ruta actualizada exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar ruta", description: error.message, variant: "destructive" });
    },
  });

  // Create logistics cost
  const createCost = useMutation({
    mutationFn: async (cost: { shipping_route_id: string; segment: string; transport_type: string; cost_per_kg: number; cost_per_cbm: number; min_cost: number; estimated_days_min?: number; estimated_days_max?: number; notes?: string | null; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("route_logistics_costs")
        .insert([cost])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-logistics-costs"] });
      queryClient.invalidateQueries({ queryKey: ["shipping_tiers_all"] });
      toast({ title: "Costo de logística creado exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear costo", description: error.message, variant: "destructive" });
    },
  });

  // Update logistics cost
  const updateCost = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; segment?: string; transport_type?: string; cost_per_kg?: number; cost_per_cbm?: number; min_cost?: number; estimated_days_min?: number; estimated_days_max?: number; notes?: string | null; is_active?: boolean }) => {
      const { error } = await supabase
        .from("route_logistics_costs")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-logistics-costs"] });
      queryClient.invalidateQueries({ queryKey: ["shipping_tiers_all"] });
      toast({ title: "Costo actualizado exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar costo", description: error.message, variant: "destructive" });
    },
  });

  // Delete logistics cost
  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("route_logistics_costs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-logistics-costs"] });
      queryClient.invalidateQueries({ queryKey: ["shipping_tiers_all"] });
      toast({ title: "Costo eliminado exitosamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar costo", description: error.message, variant: "destructive" });
    },
  });

  return {
    transitHubs,
    countries,
    routes,
    logisticsCosts,
    isLoading: loadingHubs || loadingCountries || loadingRoutes || loadingCosts,
    createHub,
    updateHub,
    createCountry,
    updateCountry,
    createRoute,
    updateRoute,
    createCost,
    updateCost,
    deleteCost,
  };
}
