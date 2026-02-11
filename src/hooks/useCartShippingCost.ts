import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CartShippingSummary {
  weight_rounded_kg: number;
  base_cost: number;
  extra_cost: number;
  total_cost_with_type: number;
  shipping_type_name?: string | null;
  shipping_type_display?: string | null;
}

export interface CartItem {
  product_id: string;
  variant_id?: string;
  weight_kg: number;
  quantity: number;
}

/**
 * Hook para calcular costos de envío del carrito
 * Usa la función calculate_shipping_cost_cart() que:
 * 1. Suma pesos sin redondear
 * 2. Redondea a superior (CEIL) el total
 * 3. Calcula costos basados en peso redondeado
 * 4. Aplica surcharges del tipo de envío seleccionado
 * 
 * @param cartItems - Items del carrito con peso real
 * @param routeId - ID de la ruta (ej: '21420dcb-9d8a-4947-8530-aaf3519c9047')
 * @param shippingTypeId - ID del tipo de envío seleccionado (opcional)
 * @returns Resumen de costos con pesos y detalles de surcharge
 */
export const useCartShippingCost = (
  cartItems: CartItem[],
  routeId?: string,
  shippingTypeId?: string | null
) => {
  const [summary, setSummary] = useState<CartShippingSummary | null>(null);
  const [totalWeight, setTotalWeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId || !cartItems || cartItems.length === 0) {
      setSummary(null);
      setTotalWeight(0);
      return;
    }

    const calculateCost = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Step 1: Calcular peso total SIN redondear
        let totalWeightKg = 0;
        cartItems.forEach(item => {
          totalWeightKg += item.weight_kg * (item.quantity || 1);
        });
        setTotalWeight(totalWeightKg);

        // Step 2: Llamar a la función RPC con el peso total
        const { data, error: rpcError } = await supabase
          .rpc('calculate_shipping_cost_cart', {
            route_id: routeId,
            total_weight_kg: totalWeightKg,
            shipping_type_id: shippingTypeId || null,
          });

        if (rpcError) {
          throw rpcError;
        }

        if (!data || data.length === 0) {
          setSummary(null);
          return;
        }

        setSummary({
          weight_rounded_kg: parseFloat(data[0].weight_rounded_kg),
          base_cost: parseFloat(data[0].base_cost),
          extra_cost: parseFloat(data[0].extra_cost),
          total_cost_with_type: parseFloat(data[0].total_cost_with_type),
          shipping_type_name: data[0].shipping_type_name,
          shipping_type_display: data[0].shipping_type_display,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error calculating shipping';
        setError(message);
        setSummary(null);
        console.error('Shipping cost calculation error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    calculateCost();
  }, [cartItems, routeId, shippingTypeId]);

  /**
   * Método para recalcular con otro tipo de envío
   * Útil cuando el usuario cambia el tipo sin modificar items
   */
  const updateShippingType = useCallback(
    async (newShippingTypeId?: string | null): Promise<CartShippingSummary | null> => {
      if (!routeId || !cartItems || cartItems.length === 0) {
        return null;
      }

      try {
        setIsLoading(true);
        setError(null);

        let totalWeightKg = 0;
        cartItems.forEach(item => {
          totalWeightKg += item.weight_kg * (item.quantity || 1);
        });

        const { data, error: rpcError } = await supabase
          .rpc('calculate_shipping_cost_cart', {
            route_id: routeId,
            total_weight_kg: totalWeightKg,
            shipping_type_id: newShippingTypeId || null,
          });

        if (rpcError) {
          throw rpcError;
        }

        if (!data || data.length === 0) {
          return null;
        }

        const result: CartShippingSummary = {
          weight_rounded_kg: parseFloat(data[0].weight_rounded_kg),
          base_cost: parseFloat(data[0].base_cost),
          extra_cost: parseFloat(data[0].extra_cost),
          total_cost_with_type: parseFloat(data[0].total_cost_with_type),
          shipping_type_name: data[0].shipping_type_name,
          shipping_type_display: data[0].shipping_type_display,
        };

        setSummary(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error calculating shipping';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [cartItems, routeId]
  );

  return {
    summary,
    totalWeight,
    isLoading,
    error,
    updateShippingType,
  };
};

/**
 * Hook simplificado para calcular peso total del carrito
 * Solo suma pesos SIN redondear
 */
export const useCartTotalWeight = (cartItems: CartItem[]): number => {
  const [totalWeight, setTotalWeight] = useState(0);

  useEffect(() => {
    let weight = 0;
    cartItems.forEach(item => {
      weight += item.weight_kg * (item.quantity || 1);
    });
    setTotalWeight(weight);
  }, [cartItems]);

  return totalWeight;
};
