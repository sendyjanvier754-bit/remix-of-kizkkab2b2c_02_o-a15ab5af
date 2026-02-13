import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CartShippingCostView {
  total_items: number;
  total_weight_kg: number;
  weight_rounded_kg: number;
  shipping_cost_usd: number;
  formula?: string;
  message?: string;
}

/**
 * Hook para calcular el costo de envío SOLO para los items seleccionados
 * Usa la función RPC calculate_shipping_cost_for_selected_items
 * 
 * @param selectedItemIds - Set de IDs de cart_items seleccionados (con checkbox marcado)
 * @returns Datos del costo de envío calculado SOLO para items seleccionados
 */
export const useCartShippingCostView = (selectedItemIds?: Set<string>) => {
  // Convertir Set a Array de UUIDs
  const itemIdsArray = selectedItemIds ? Array.from(selectedItemIds) : [];

  return useQuery({
    queryKey: ['cart-shipping-cost-selected', itemIdsArray],
    queryFn: async () => {
      // Si no hay items seleccionados, retornar null
      if (itemIdsArray.length === 0) {
        return {
          total_items: 0,
          total_weight_kg: 0,
          weight_rounded_kg: 0,
          shipping_cost_usd: 0,
          message: 'No items selected'
        } as CartShippingCostView;
      }

      // Llamar a la función RPC con los IDs seleccionados
      const { data, error } = await supabase
        .rpc('calculate_shipping_cost_for_selected_items', {
          p_item_ids: itemIdsArray
        });

      if (error) {
        console.error('Error calculating shipping cost:', error);
        throw error;
      }

      // La función retorna JSON, parsearlo
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      
      return {
        total_items: result.total_items,
        total_weight_kg: result.total_weight_kg,
        weight_rounded_kg: result.weight_rounded_kg,
        shipping_cost_usd: result.shipping_cost_usd,
        formula: result.formula,
        message: result.message
      } as CartShippingCostView;
    },
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: itemIdsArray.length > 0, // Solo ejecutar si hay items seleccionados
  });
};
