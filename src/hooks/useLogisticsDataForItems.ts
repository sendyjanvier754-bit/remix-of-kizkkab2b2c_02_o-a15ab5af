import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ItemForLogistics {
  productId: string;
  variantId?: string;
}

export interface LogisticsItemResult {
  productId: string;
  variantId?: string;
  weight_kg: number;
  shippingCost: number;
}

export interface LogisticsDataResult {
  totalWeight_kg: number;
  totalCost: number;
  itemCosts: LogisticsItemResult[];
  isEmpty: boolean;
}

/**
 * Hook to fetch logistics data (weight and shipping costs) from v_logistics_data view
 * This ensures all parts of the app use the same shipping cost calculations
 * 
 * Returns data in the same format as useShippingCostCalculationForCart for compatibility
 */
export const useLogisticsDataForItems = (items: ItemForLogistics[]) => {
  const [result, setResult] = useState<LogisticsDataResult>({
    totalWeight_kg: 0,
    totalCost: 0,
    itemCosts: [],
    isEmpty: items.length === 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      setResult({
        totalWeight_kg: 0,
        totalCost: 0,
        itemCosts: [],
        isEmpty: true,
      });
      return;
    }

    const fetchLogisticsData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Build query conditions - we need to fetch from v_logistics_data
        // matching products (variant_id IS NULL) or specific variants
        const productIds = items
          .filter(item => !item.variantId)
          .map(item => item.productId);
        
        const variantIds = items
          .filter(item => item.variantId)
          .map(item => item.variantId!);

        let logisticsData: any[] = [];

        // Fetch product-level logistics data (only weight_kg, no cost yet)
        if (productIds.length > 0) {
          const { data, error: err } = await supabase
            .from('v_logistics_data')
            .select('product_id, variant_id, weight_kg')
            .in('product_id', productIds)
            .is('variant_id', null);

          if (err) throw err;
          if (data) logisticsData = logisticsData.concat(data);
        }

        // Fetch variant-level logistics data (only weight_kg, no cost yet)
        if (variantIds.length > 0) {
          const { data, error: err } = await supabase
            .from('v_logistics_data')
            .select('product_id, variant_id, weight_kg')
            .in('variant_id', variantIds);

          if (err) throw err;
          if (data) logisticsData = logisticsData.concat(data);
        }

        // Fetch shipping rates (standard tier)
        const { data: shippingTier } = await supabase
          .from('shipping_tiers')
          .select('tramo_a_cost_per_kg, tramo_b_cost_per_lb')
          .eq('tier_type', 'standard')
          .eq('is_active', true)
          .single();

        // Fetch zone surcharge (Haiti zone - with fallback)
        const { data: zone } = await supabase
          .from('shipping_zones')
          .select('final_delivery_surcharge')
          .or('zone_name.eq.HAITI_CENTRO,zone_name.ilike.%HAITI%')
          .eq('is_active', true)
          .order('final_delivery_surcharge', { ascending: true })
          .limit(1)
          .single();

        const costPerKg = shippingTier?.tramo_a_cost_per_kg || 0;
        const costPerLb = shippingTier?.tramo_b_cost_per_lb || 0;
        const zoneSurcharge = zone?.final_delivery_surcharge || 0;

        // NUEVA LÓGICA: Sumar pesos SIN redondear primero
        let totalWeight_kg = 0;
        const itemWeights: Array<{productId: string, variantId: string | null, weight_kg: number}> = [];

        // Map the results to match the items requested
        items.forEach(item => {
          let matchedData = logisticsData.find(ld => {
            if (item.variantId) {
              return ld.variant_id === item.variantId;
            } else {
              return ld.product_id === item.productId && ld.variant_id === null;
            }
          });

          const weight_kg = matchedData?.weight_kg || 0.3; // Default fallback weight
          
          itemWeights.push({
            productId: item.productId,
            variantId: item.variantId || null,
            weight_kg: weight_kg,
          });

          // Sumar peso SIN redondear
          totalWeight_kg += weight_kg;
        });

        // REDONDEAR EL PESO TOTAL (no individual)
        const roundedTotalWeight_kg = Math.max(Math.ceil(totalWeight_kg), 1);

        // Calcular costo SOLO UNA VEZ con el peso total redondeado
        const totalCost = 
          (roundedTotalWeight_kg * costPerKg) +
          (roundedTotalWeight_kg * 2.20462 * costPerLb) +
          zoneSurcharge;

        // Para compatibilidad, distribuir el costo proporcionalmente
        const itemCosts: LogisticsItemResult[] = itemWeights.map(item => {
          const itemProportion = totalWeight_kg > 0 ? item.weight_kg / totalWeight_kg : 0;
          return {
            productId: item.productId,
            variantId: item.variantId,
            weight_kg: item.weight_kg,
            shippingCost: totalCost * itemProportion,
          };
        });

        setResult({
          totalWeight_kg: totalWeight_kg, // Peso total sin redondear (para referencia)
          totalCost: Math.round(totalCost * 100) / 100, // Costo total con peso redondeado
          itemCosts: itemCosts,
          isEmpty: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error fetching logistics data';
        setError(message);
        console.error('Logistics data fetch error:', err);
        
        // Fallback: return default values to prevent UI breakage
        setResult({
          totalWeight_kg: 0,
          totalCost: 0,
          itemCosts: [],
          isEmpty: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogisticsData();
  }, [items]);

  return { result, isLoading, error };
};

/**
 * Hook: Obtener todas las rutas de envío disponibles
 */
export function useShippingRoutes() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoutes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('shipping_routes')
          .select('*')
          .eq('is_active', true);

        if (err) throw err;
        setRoutes(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        setRoutes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoutes();
  }, []);

  return { routes, isLoading, error };
}

/**
 * Hook: Obtener todas las zonas de envío disponibles
 */
export function useShippingZones() {
  const [zones, setZones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchZones = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('shipping_zones')
          .select('*')
          .eq('is_active', true)
          .order('country', { ascending: true })
          .order('zone_name', { ascending: true });

        if (err) throw err;
        setZones(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        setZones([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchZones();
  }, []);

  return { zones, isLoading, error };
}

