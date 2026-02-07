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

        // Fetch product-level logistics data
        if (productIds.length > 0) {
          const { data, error: err } = await supabase
            .from('v_logistics_data')
            .select('product_id, variant_id, weight_kg, shipping_cost_per_unit')
            .in('product_id', productIds)
            .is('variant_id', null);

          if (err) throw err;
          if (data) logisticsData = logisticsData.concat(data);
        }

        // Fetch variant-level logistics data
        if (variantIds.length > 0) {
          const { data, error: err } = await supabase
            .from('v_logistics_data')
            .select('product_id, variant_id, weight_kg, shipping_cost_per_unit')
            .in('variant_id', variantIds);

          if (err) throw err;
          if (data) logisticsData = logisticsData.concat(data);
        }

        // Calculate totals
        let totalWeight_kg = 0;
        let totalCost = 0;
        const itemCosts: LogisticsItemResult[] = [];

        // Map the results to match the items requested
        items.forEach(item => {
          let matchedData = logisticsData.find(ld => {
            if (item.variantId) {
              return ld.variant_id === item.variantId;
            } else {
              return ld.product_id === item.productId && ld.variant_id === null;
            }
          });

          // If no match found, use defaults (should not happen if DB is in sync)
          if (!matchedData) {
            matchedData = {
              product_id: item.productId,
              variant_id: item.variantId || null,
              weight_kg: 0.3, // Default fallback weight
              shipping_cost_per_unit: 0,
            };
          }

          const weight_kg = matchedData.weight_kg || 0.3;
          const shipping_cost = matchedData.shipping_cost_per_unit || 0;

          itemCosts.push({
            productId: matchedData.product_id,
            variantId: matchedData.variant_id,
            weight_kg: weight_kg,
            shippingCost: shipping_cost,
          });

          totalWeight_kg += weight_kg;
          totalCost += shipping_cost;
        });

        setResult({
          totalWeight_kg: totalWeight_kg,
          totalCost: totalCost,
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
