import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessPanelDataItem {
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
 * Hook para obtener datos del BusinessPanel desde la vista v_business_panel_data
 * 
 * @param productId - ID del producto (requerido para búsqueda)
 * @param variantId - ID de la variante (opcional, para filtrar variante específica)
 * @returns Objeto con datos y estado de carga
 */
export const useBusinessPanelData = (productId?: string, variantId?: string) => {
  const [data, setData] = useState<BusinessPanelDataItem | null>(null);
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

        let query = supabase
          .from('v_business_panel_data')
          .select('*')
          .eq('product_id', productId);

        // Si se proporciona variantId, filtrar por esa variante
        if (variantId) {
          query = query.eq('variant_id', variantId);
        }

        const { data: result, error: err } = await query.single();

        if (err) {
          setError(err.message);
          setData(null);
        } else {
          setData(result as BusinessPanelDataItem);
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
 * Hook para obtener múltiples items de BusinessPanel
 * 
 * @param items - Array de objetos con { productId, variantId? }
 * @returns Map de productId/variantId -> datos
 */
export const useBusinessPanelDataBatch = (
  items: Array<{ productId: string; variantId?: string }>
) => {
  const [dataMap, setDataMap] = useState<Map<string, BusinessPanelDataItem>>(new Map());
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

        // Construir un Map de claves para búsqueda
        const keysToFetch = items.map(item => 
          item.variantId ? `${item.productId}-${item.variantId}` : item.productId
        );

        // Obtener todos los datos
        const { data: results, error: err } = await supabase
          .from('v_business_panel_data')
          .select('*')
          .in('product_id', items.map(i => i.productId));

        if (err) {
          setError(err.message);
          setDataMap(new Map());
        } else {
          // Crear Map con claves basadas en variant_id o product_id
          const newMap = new Map<string, BusinessPanelDataItem>();
          (results as BusinessPanelDataItem[]).forEach(item => {
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
