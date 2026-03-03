import { useMemo } from 'react';
import { useCountriesRoutes, RouteLogisticsCost, ShippingRoute } from './useCountriesRoutes';
import { RouteInfo, RouteSegment } from '@/components/admin/pricing/RouteSegmentTimeline';

/**
 * Hook to get routes formatted for the pricing calculator
 * with segments and costs properly structured
 */
export function useRoutePricing() {
  const { routes, logisticsCosts, transitHubs, countries, isLoading } = useCountriesRoutes();

  const formattedRoutes = useMemo((): RouteInfo[] => {
    if (!routes || !logisticsCosts) return [];

    return routes.map((route): RouteInfo => {
      // Get segments for this route
      const routeCosts = logisticsCosts.filter(
        (c) => c.shipping_route_id === route.id
      );

      const segments: RouteSegment[] = routeCosts.map((cost): RouteSegment => ({
        id: cost.id,
        segment: cost.segment as RouteSegment['segment'],
        costPerKg: Number(cost.cost_per_kg) || 0,
        costPerCbm: Number(cost.cost_per_cbm) || 0,
        minCost: Number(cost.min_cost) || 0,
        estimatedDaysMin: cost.estimated_days_min || 0,
        estimatedDaysMax: cost.estimated_days_max || 0,
        notes: cost.notes,
        isActive: cost.is_active,
      }));

      return {
        id: route.id,
        countryName: route.destination_country_info?.name || (typeof route.destination_country === 'object' ? (route.destination_country as any)?.name : null) || 'Desconocido',
        countryCode: route.destination_country_info?.code || (typeof route.destination_country === 'object' ? (route.destination_country as any)?.code : null) || '??',
        hubName: route.transit_hub?.name,
        hubCode: route.transit_hub?.code,
        isDirect: route.is_direct,
        isActive: route.is_active,
        segments,
      };
    });
  }, [routes, logisticsCosts]);

  /**
   * Calculate total logistics cost for a route given a weight
   */
  const calculateRouteCost = (routeId: string, weightKg: number) => {
    const route = formattedRoutes.find((r) => r.id === routeId);
    if (!route) return { cost: 0, days: { min: 0, max: 0 } };

    let totalCost = 0;
    let totalDaysMin = 0;
    let totalDaysMax = 0;

    route.segments.filter((s) => s.isActive).forEach((segment) => {
      const segmentCost = Math.max(segment.costPerKg * weightKg, segment.minCost);
      totalCost += segmentCost;
      totalDaysMin += segment.estimatedDaysMin;
      totalDaysMax += segment.estimatedDaysMax;
    });

    return {
      cost: totalCost,
      days: { min: totalDaysMin, max: totalDaysMax },
    };
  };

  /**
   * Get a summary of a route for display
   */
  const getRouteSummary = (routeId: string) => {
    const route = formattedRoutes.find((r) => r.id === routeId);
    if (!route) return null;

    const activeSegments = route.segments.filter((s) => s.isActive);
    const totalDaysMin = activeSegments.reduce((sum, s) => sum + s.estimatedDaysMin, 0);
    const totalDaysMax = activeSegments.reduce((sum, s) => sum + s.estimatedDaysMax, 0);
    const minCostPerKg = activeSegments.reduce((sum, s) => sum + s.costPerKg, 0);

    return {
      name: route.isDirect
        ? `China → ${route.countryName} (Directo)`
        : `China → ${route.hubName} → ${route.countryName}`,
      segments: activeSegments.length,
      daysRange: `${totalDaysMin}-${totalDaysMax} días`,
      costPerKg: minCostPerKg,
      isActive: route.isActive,
    };
  };

  return {
    routes: formattedRoutes,
    isLoading,
    calculateRouteCost,
    getRouteSummary,
  };
}
