import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductShippingCost {
  product_id: string;
  product_name: string;
  sku: string;
  weight_kg: number;
  is_oversize: boolean;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  route_id: string;
  calculated_weight_kg: number;
  base_cost: number;
  oversize_surcharge: number;
  dimensional_surcharge: number;
  volume_m3: number;
  total_cost: number;
  is_active: boolean;
  last_updated: string;
}

export const useProductShippingCosts = (productIds?: string[]) => {
  const [shippingCosts, setShippingCosts] = useState<Map<string, ProductShippingCost>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoizar el string de IDs para evitar re-renders infinitos
  const productIdString = useMemo(() => {
    if (!productIds || productIds.length === 0) return null;
    return productIds.join(',');
  }, [productIds]);

  useEffect(() => {
    if (!productIdString) {
      setShippingCosts(new Map());
      setIsLoading(false);
      return;
    }

    const fetchShippingCosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Extraer IDs del string memoizado
        const ids = productIdString.split(',');
        
        // Consultar la vista v_product_shipping_costs
        const { data, error: queryError } = await (supabase as any)
          .from('v_product_shipping_costs')
          .select('*')
          .in('product_id', ids);

        if (queryError) {
          console.warn('Error fetching shipping costs from view:', queryError);
          // No lanzar error, solo usar fallback (costo 0)
          setShippingCosts(new Map());
          return;
        }

        // Crear un mapa de product_id -> shipping cost
        const costsMap = new Map<string, ProductShippingCost>();
        if (data && Array.isArray(data)) {
          data.forEach((item: any) => {
            costsMap.set(item.product_id, item);
          });
        }

        setShippingCosts(costsMap);
      } catch (err) {
        console.warn('Error fetching shipping costs:', err);
        // Fallback: no fallar completamente, simplemente usar mapa vacío
        setShippingCosts(new Map());
      } finally {
        setIsLoading(false);
      }
    };

    fetchShippingCosts();
  }, [productIdString]);

  const getShippingCost = (productId: string): ProductShippingCost | undefined => {
    return shippingCosts.get(productId);
  };

  const getTotalCost = (productId: string): number => {
    const cost = shippingCosts.get(productId);
    return cost?.total_cost ?? 0;
  };

  const getBaseCost = (productId: string): number => {
    const cost = shippingCosts.get(productId);
    return cost?.base_cost ?? 0;
  };

  const getOversizeSurcharge = (productId: string): number => {
    const cost = shippingCosts.get(productId);
    return cost?.oversize_surcharge ?? 0;
  };

  const getDimensionalSurcharge = (productId: string): number => {
    const cost = shippingCosts.get(productId);
    return cost?.dimensional_surcharge ?? 0;
  };

  return {
    shippingCosts,
    isLoading,
    error,
    getShippingCost,
    getTotalCost,
    getBaseCost,
    getOversizeSurcharge,
    getDimensionalSurcharge,
  };
};
