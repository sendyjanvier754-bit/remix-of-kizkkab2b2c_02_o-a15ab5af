import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessPanelDataWithShipping {
  product_id: string | null;
  variant_id: string | null;
  item_name: string;
  sku: string;
  item_type: 'product' | 'variant';
  cost_per_unit: number;
  weight_kg: number;
  shipping_cost_per_unit: number;
  suggested_pvp_per_unit: number;
  investment_1unit: number;
  revenue_1unit: number;
  profit_1unit: number;
  margin_percentage: number;
  is_active: boolean;
  last_updated: string;
}

/**
 * Hook para obtener datos del BusinessPanel usando las nuevas funciones de cálculo
 * Usa v_business_panel_with_shipping_functions que utiliza calculate_shipping_cost()
 * 
 * Ventajas:
 * - Costos de envío calculados con función SQL
 * - Peso real sin redondeo en item level
 * - Datos consistentes con carrito
 * 
 * @param productId - ID del producto (requerido para búsqueda)
 * @param variantId - ID de la variante (opcional)
 * @returns Objeto con datos y estado de carga
 */
export const useBusinessPanelDataWithShipping = (productId?: string, variantId?: string) => {
  const [data, setData] = useState<BusinessPanelDataWithShipping | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let query = (supabase as any)
          .from('v_business_panel_with_shipping_functions')
          .select('*')
          .eq('product_id', productId);

        if (variantId) {
          query = query.eq('variant_id', variantId);
        }

        const { data: result, error: err } = await query.single();

        if (err) {
          setError(err.message);
          setData(null);
        } else {
          setData(result as BusinessPanelDataWithShipping);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [productId, variantId]);

  return { data, isLoading, error };
};

/**
 * Hook para obtener múltiples items de BusinessPanel con costos de envío
 * 
 * @param items - Array de { productId, variantId? }
 * @returns Map de productId/variantId -> datos
 */
export const useBusinessPanelDataWithShippingBatch = (
  items: Array<{ productId: string; variantId?: string }>
) => {
  const [dataMap, setDataMap] = useState<Map<string, BusinessPanelDataWithShipping>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!items || items.length === 0) {
      setDataMap(new Map());
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: results, error: err } = await (supabase as any)
          .from('v_business_panel_with_shipping_functions')
          .select('*')
          .in('product_id', items.map(i => i.productId));

        if (err) {
          setError(err.message);
          setDataMap(new Map());
        } else {
          const newMap = new Map<string, BusinessPanelDataWithShipping>();
          (results as BusinessPanelDataWithShipping[]).forEach(item => {
            const key = item.variant_id 
              ? `${item.product_id}-${item.variant_id}`
              : item.product_id!;
            newMap.set(key, item);
          });
          setDataMap(newMap);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setDataMap(new Map());
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [items]);

  return { dataMap, isLoading, error };
};
