import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CoverageAlert {
  type: 'markets_without_payment' | 'markets_without_route';
  severity: 'warning' | 'error';
  count: number;
  message: string;
  items?: { id: string; name: string }[];
}

export const useCoverageAlerts = () => {
  return useQuery({
    queryKey: ['coverage-alerts'],
    queryFn: async (): Promise<CoverageAlert[]> => {
      const alerts: CoverageAlert[] = [];

      // Use markets_dashboard view which has route_count computed from shipping_routes.market_id
      const { data: allActiveMarkets } = await supabase
        .from('markets_dashboard')
        .select('id, name, route_count, payment_method_count')
        .eq('is_active', true);

      // Markets without payment methods (use precomputed payment_method_count from view)
      const marketsWithoutPayment = (allActiveMarkets || []).filter(m => ((m as any).payment_method_count ?? 0) === 0);

      if (marketsWithoutPayment.length > 0) {
        alerts.push({
          type: 'markets_without_payment',
          severity: 'error',
          count: marketsWithoutPayment.length,
          message: `${marketsWithoutPayment.length} mercado(s) sin métodos de pago`,
          items: marketsWithoutPayment.map(m => ({ id: m.id, name: m.name })),
        });
      }

      // Markets without shipping route (use route_count from view — new architecture)
      const marketsWithoutRoute = (allActiveMarkets || []).filter(m => ((m as any).route_count ?? 0) === 0);

      if (marketsWithoutRoute.length > 0) {
        alerts.push({
          type: 'markets_without_route',
          severity: 'warning',
          count: marketsWithoutRoute.length,
          message: `${marketsWithoutRoute.length} mercado(s) sin ruta logística`,
          items: marketsWithoutRoute.map(m => ({ id: m.id, name: m.name })),
        });
      }

      return alerts;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export default useCoverageAlerts;
