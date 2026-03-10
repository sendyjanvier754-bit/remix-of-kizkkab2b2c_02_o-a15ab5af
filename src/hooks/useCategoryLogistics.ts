import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryLogisticsItem {
  product_id: string;
  variant_id: string | null;
  item_name: string;
  sku: string;
  item_type: 'product' | 'variant';
  weight_kg: number;
  shipping_cost: number;
  is_active: boolean;
}

/**
 * Hook para obtener datos de logística para el módulo de categoría
 * Usa v_category_logistics que utiliza calculate_shipping_cost()
 * 
 * Útil para:
 * - Mostrar costos de envío en listings de categoría
 * - Información de peso para búsqueda/filtrado
 * - Costos de envío individual (sin carrito)
 * 
 * @param categoryId - ID de categoría para filtrado (opcional)
 * @returns Array de items con información de logística
 */
export const useCategoryLogistics = () => {
  const [items, setItems] = useState<CategoryLogisticsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: err } = await (supabase as any)
          .from('v_category_logistics')
          .select('*')
          .eq('is_active', true);

        if (err) {
          setError(err.message);
          setItems([]);
        } else {
          setItems((data || []) as CategoryLogisticsItem[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { items, isLoading, error };
};

/**
 * Hook para obtener logística de un producto/variante específico
 * 
 * @param productId - ID del producto
 * @param variantId - ID de la variante (opcional)
 * @returns Datos de logística del item
 */
export const useCategoryLogisticsItem = (productId?: string, variantId?: string) => {
  const [item, setItem] = useState<CategoryLogisticsItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setItem(null);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let query = supabase
          .from('v_category_logistics')
          .select('*')
          .eq('product_id', productId)
          .eq('is_active', true);

        if (variantId) {
          query = query.eq('variant_id', variantId);
        } else {
          query = query.is('variant_id', null);
        }

        const { data: result, error: err } = await query.single();

        if (err) {
          setError(err.message);
          setItem(null);
        } else {
          setItem(result as CategoryLogisticsItem);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setItem(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [productId, variantId]);

  return { item, isLoading, error };
};

/**
 * Hook para obtener logística de múltiples productos
 * Útil para listados de categoría
 * 
 * @param productIds - Array de IDs de productos
 * @returns Map de productId -> datos
 */
export const useCategoryLogisticsBatch = (productIds: string[]) => {
  const [itemMap, setItemMap] = useState<Map<string, CategoryLogisticsItem>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productIds || productIds.length === 0) {
      setItemMap(new Map());
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from('v_category_logistics')
          .select('*')
          .in('product_id', productIds)
          .eq('is_active', true);

        if (err) {
          setError(err.message);
          setItemMap(new Map());
        } else {
          const newMap = new Map<string, CategoryLogisticsItem>();
          (data as CategoryLogisticsItem[]).forEach(item => {
            const key = item.variant_id 
              ? `${item.product_id}-${item.variant_id}`
              : item.product_id;
            newMap.set(key, item);
          });
          setItemMap(newMap);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setItemMap(new Map());
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [productIds]);

  return { itemMap, isLoading, error };
};
