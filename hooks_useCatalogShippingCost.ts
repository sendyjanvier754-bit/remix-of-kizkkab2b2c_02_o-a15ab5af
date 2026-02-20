/**
 * 🎣 HOOK REACT: useCatalogShippingCost
 * 
 * Obtiene el costo de envío unitario de un producto hacia un país específico
 * SIN REDONDEO - retorna decimales completos
 * 
 * @param productId - UUID del producto
 * @param destinationCountryId - UUID del país destino
 * @returns { data, loading, error }
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Tipos TypeScript
interface ShippingCostData {
  product_id: string;
  product_name: string;
  product_weight_kg: number;
  product_weight_lb: number;
  destination_country: string;
  destination_country_code: string;
  route_id: string;
  tier_type: 'standard' | 'express';
  tier_name: string;
  tramo_a_cost: number;           // China → Hub (sin redondeo)
  tramo_b_cost: number;           // Hub → Destino (sin redondeo)
  shipping_cost_usd: number;      // Total USD (sin redondeo) ← columna "Logística"
  eta_min_days: number;
  eta_max_days: number;
  is_available: boolean;
  error_message: string | null;
}

interface UseShippingCostReturn {
  data: ShippingCostData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Inicializar cliente Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

// ✅ HOOK PRINCIPAL
export const useCatalogShippingCost = (
  productId: string | null,
  destinationCountryId: string | null,
  tierType: 'standard' | 'express' = 'standard'
): UseShippingCostReturn => {
  const [data, setData] = useState<ShippingCostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Función para obtener el costo
  const fetchShippingCost = useCallback(async () => {
    // Validación: ambos parámetros son requeridos
    if (!productId || !destinationCountryId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Llamar función SQL en Supabase
      const { data: result, error: supabaseError } = await supabase
        .rpc('get_product_shipping_cost_by_country', {
          p_product_id: productId,
          p_destination_country_id: destinationCountryId,
          p_tier_type: tierType,
        })
        .single(); // Esperamos UN solo resultado

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      if (result) {
        // Si la función retorna error_message, significa que hubo problema
        if (result.error_message) {
          console.warn(`Shipping Cost Warning: ${result.error_message}`);
        }
        setData(result as ShippingCostData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(new Error(`No se pudo obtener costo de envío: ${errorMessage}`));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productId, destinationCountryId, tierType]);

  // Efecto: ejecutar cuando cambien productId o destinationCountryId
  useEffect(() => {
    fetchShippingCost();
  }, [productId, destinationCountryId, tierType, fetchShippingCost]);

  return {
    data,
    loading,
    error,
    refetch: fetchShippingCost,
  };
};

/**
 * 🎣 HOOK ALTERNATIVO: useCatalogShippingCostBatch
 * 
 * Para obtener costos de MÚLTIPLES productos a la vez
 * Más eficiente que llamar hook individual para cada producto
 */

interface BatchShippingData {
  [productId: string]: ShippingCostData;
}

interface UseBatchShippingCostReturn {
  data: BatchShippingData;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useCatalogShippingCostBatch = (
  productIds: string[],
  destinationCountryId: string | null
): UseBatchShippingCostReturn => {
  const [data, setData] = useState<BatchShippingData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBatchShippingCost = useCallback(async () => {
    if (!destinationCountryId || productIds.length === 0) {
      setData({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Ejecutar función para cada producto (o hacer una sola query con array)
      const promises = productIds.map((productId) =>
        supabase
          .rpc('get_product_shipping_cost_by_country', {
            p_product_id: productId,
            p_destination_country_id: destinationCountryId,
          })
          .single()
      );

      const results = await Promise.all(promises);

      // Organizar resultados por productId
      const batchData: BatchShippingData = {};
      results.forEach((result) => {
        if (result.data) {
          batchData[result.data.product_id] = result.data as ShippingCostData;
        } else if (result.error) {
          console.error('Error en batch:', result.error);
        }
      });

      setData(batchData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(new Error(`Error en batch: ${errorMessage}`));
      setData({});
    } finally {
      setLoading(false);
    }
  }, [productIds, destinationCountryId]);

  useEffect(() => {
    fetchBatchShippingCost();
  }, [productIds, destinationCountryId, fetchBatchShippingCost]);

  return {
    data,
    loading,
    error,
    refetch: fetchBatchShippingCost,
  };
};

// ✅ Exportar tipos para usar en otros componentes
export type { ShippingCostData, UseShippingCostReturn, UseBatchShippingCostReturn };
