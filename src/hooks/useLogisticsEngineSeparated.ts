import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * MOTOR DE LOGÍSTICA: Independiente de precios
 * 
 * Responsabilidades:
 * - Calcular costos de logística por ruta
 * - Obtener información de rutas disponibles
 * - NO depende de productos ni precios
 * - Retorna desglose de tramos (A + B)
 * 
 * Uso:
 * const { calculateLogisticsCost, getAvailableRoutes } = useLogisticsEngine();
 * const logistics = await calculateLogisticsCost(routeId, weight);
 */

export interface RouteSegment {
  segment: 'china_to_transit' | 'transit_to_destination';
  cost_per_kg: number;
  min_cost: number;
  estimated_days_min: number;
  estimated_days_max: number;
}

export interface ShippingRoute {
  route_id: string;
  destination_country_name: string;
  country_code: string;
  transit_hub_name: string | null;
  is_direct: boolean;
  segment_a: RouteSegment | null;
  segment_b: RouteSegment | null;
}

export interface LogisticsCostResult {
  total_cost: number;
  tramo_a_china_to_hub: number;
  tramo_b_hub_to_destination: number;
  estimated_days_min: number;
  estimated_days_max: number;
  eta_date_min: string; // ISO date (YYYY-MM-DD)
  eta_date_max: string; // ISO date (YYYY-MM-DD)
}

export interface LogisticsBreakdown {
  routeId: string;
  routeName: string;
  totalCost: number;
  tramo_a: number;
  tramo_b: number;
  daysMin: number;
  daysMax: number;
  costPerKg: number;
  weight: number;
}

export function useLogisticsEngine() {
  // Query: Obtener rutas disponibles
  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['shipping-routes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_rutas_logistica')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching shipping routes:', error);
        throw error;
      }
      return (data || []) as ShippingRoute[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });

  /**
   * Calcular costo de logística para una ruta específica
   * 
   * @param routeId - ID de la ruta de envío
   * @param weightKg - Peso en kg
   * @param weightCbm - Volumen en CBM (opcional)
   * @returns LogisticsCostResult con desglose
   */
  const calculateLogisticsCost = async (
    routeId: string,
    weightKg: number,
    weightCbm: number = 0
  ): Promise<LogisticsCostResult | null> => {
    try {
      // Llamar función RPC de Supabase que calcula logística
      const { data, error } = await supabase.rpc('calculate_route_cost', {
        p_route_id: routeId,
        p_weight_kg: weightKg,
        p_weight_cbm: weightCbm,
      });

      if (error) {
        console.error(`Error calculating logistics for route ${routeId}:`, error);
        return null;
      }

      return data as unknown as LogisticsCostResult;
    } catch (error) {
      console.error('Exception in calculateLogisticsCost:', error);
      return null;
    }
  };

  /**
   * Obtener rutas disponibles para un país específico
   */
  const getRoutesByCountry = (countryCode: string): ShippingRoute[] => {
    return routes.filter(route => route.country_code === countryCode);
  };

  /**
   * Obtener información de una ruta específica
   */
  const getRouteInfo = (routeId: string): ShippingRoute | null => {
    return routes.find(route => route.route_id === routeId) || null;
  };

  /**
   * Calcular costo por kg para una ruta
   */
  const calculateCostPerKg = (routeId: string, weightKg: number): number => {
    const route = getRouteInfo(routeId);
    if (!route || !route.segment_a || !route.segment_b) return 0;

    const segmentACost = Math.max(
      route.segment_a.cost_per_kg * weightKg,
      route.segment_a.min_cost
    );

    const segmentBCost = Math.max(
      route.segment_b.cost_per_kg * weightKg,
      route.segment_b.min_cost
    );

    return segmentACost + segmentBCost;
  };

  /**
   * Obtener tiempo estimado de entrega
   */
  const getEstimatedDays = (routeId: string): { min: number; max: number } | null => {
    const route = getRouteInfo(routeId);
    if (!route || !route.segment_a || !route.segment_b) return null;

    return {
      min: (route.segment_a.estimated_days_min || 0) + (route.segment_b.estimated_days_min || 0),
      max: (route.segment_a.estimated_days_max || 0) + (route.segment_b.estimated_days_max || 0),
    };
  };

  /**
   * Validar si una ruta es válida y activa
   */
  const isValidRoute = (routeId: string): boolean => {
    return routes.some(route => route.route_id === routeId);
  };

  /**
   * Formatear información de logística para UI
   */
  const formatLogisticsBreakdown = (
    routeId: string,
    weightKg: number,
    logisticsCost: LogisticsCostResult
  ): LogisticsBreakdown | null => {
    const route = getRouteInfo(routeId);
    if (!route) return null;

    return {
      routeId,
      routeName: `${route.destination_country_name} ${route.transit_hub_name ? `via ${route.transit_hub_name}` : '(Direct)'}`,
      totalCost: logisticsCost.total_cost,
      tramo_a: logisticsCost.tramo_a_china_to_hub,
      tramo_b: logisticsCost.tramo_b_hub_to_destination,
      daysMin: logisticsCost.estimated_days_min,
      daysMax: logisticsCost.estimated_days_max,
      costPerKg: logisticsCost.total_cost / Math.max(weightKg, 1),
      weight: weightKg,
    };
  };

  /**
   * Comparar costos entre rutas
   */
  const getLowestCostRoute = (
    routeIds: string[],
    weightKg: number
  ): string | null => {
    let lowestRoute: string | null = null;
    let lowestCost = Infinity;

    routeIds.forEach(routeId => {
      const cost = calculateCostPerKg(routeId, weightKg);
      if (cost < lowestCost && cost > 0) {
        lowestCost = cost;
        lowestRoute = routeId;
      }
    });

    return lowestRoute;
  };

  /**
   * Obtener rutas directas vs con hub
   */
  const getDirectRoutes = (): ShippingRoute[] => {
    return routes.filter(route => route.is_direct === true);
  };

  const getIndirectRoutes = (): ShippingRoute[] => {
    return routes.filter(route => route.is_direct === false);
  };

  return {
    // Data
    routes,
    loadingRoutes,

    // Methods
    calculateLogisticsCost,
    getRoutesByCountry,
    getRouteInfo,
    calculateCostPerKg,
    getEstimatedDays,
    isValidRoute,
    formatLogisticsBreakdown,
    getLowestCostRoute,
    getDirectRoutes,
    getIndirectRoutes,
  };
}
