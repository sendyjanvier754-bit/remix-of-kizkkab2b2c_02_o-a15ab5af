import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface CartShippingCostView {
  total_items: number;
  total_weight_kg: number;
  weight_rounded_kg: number;
  shipping_cost: number;
  base_cost?: number;
  extra_cost?: number;
  message?: string;
  shipping_type_name?: string;
  shipping_type_display?: string;
  route_id?: string;
  shipping_type_id?: string;
}

/**
 * Hook para calcular el costo de envío SOLO para los items seleccionados
 * Usa la función RPC calculate_shipping_cost_for_selected_items (ORQUESTADOR)
 * 
 * ✅ VENTAJAS DEL ORQUESTADOR:
 * - La BD lee peso y cantidad directamente (no hay cálculo en frontend)
 * - Seguridad: RLS valida que los items pertenecen al usuario
 * - Precisión: Usa datos reales guardados en tiempo real
 * 
 * @param selectedItemIds - Set de IDs de cart_items seleccionados (con checkbox marcado)
 * @param selectedItems - DEPRECATED: Ya no necesario (BD tiene las cantidades)
 * @param shippingTypeId - ID del tier de envío seleccionado (opcional, usa STANDARD por defecto)
 * @returns Datos del costo de envío calculado SOLO para items seleccionados
 */
export const useCartShippingCostView = (
  selectedItemIds?: Set<string>,
  selectedItems?: Array<{ id: string; cantidad: number }>, // DEPRECATED
  shippingTypeId?: string | null
) => {
  // Convertir Set a Array de UUIDs y ordenar una sola vez
  const itemIdsArray = useMemo(() => {
    if (!selectedItemIds || selectedItemIds.size === 0) return [];
    return Array.from(selectedItemIds).sort();
  }, [selectedItemIds]);

  // queryKey simplificado - solo IDs y tier (la BD tiene las cantidades actualizadas)
  const queryKey = useMemo(() => 
    ['cart-shipping-cost-selected', itemIdsArray.join(','), shippingTypeId],
    [itemIdsArray, shippingTypeId]
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      console.log('🔍 useCartShippingCostView - fetching:', {
        itemIds: itemIdsArray,
        shippingTypeId
      });
      
      // Si no hay items seleccionados, retornar null
      if (itemIdsArray.length === 0) {
        console.log('⚠️ No items selected');
        return {
          total_items: 0,
          total_weight_kg: 0,
          weight_rounded_kg: 0,
          shipping_cost: 0,
          message: 'No items selected'
        } as CartShippingCostView;
      }

      // Llamar a la función RPC con los IDs seleccionados y el tier
      const { data, error } = await supabase
        .rpc('calculate_shipping_cost_for_selected_items', {
          p_item_ids: itemIdsArray,
          p_shipping_type_id: shippingTypeId || null
        });

      if (error) {
        console.error('❌ Error calculating shipping cost:', error);
        throw error;
      }

      console.log('✅ Raw RPC response:', data);

      // La función retorna JSON, parsearlo
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      
      console.log('📦 Parsed result:', result);
      
      return {
        total_items: result.total_items,
        total_weight_kg: result.total_weight_kg,
        weight_rounded_kg: result.weight_rounded_kg,
        shipping_cost: result.shipping_cost,
        base_cost: result.base_cost,
        extra_cost: result.extra_cost,
        message: result.message,
        shipping_type_name: result.shipping_type_name,
        shipping_type_display: result.shipping_type_display,
        route_id: result.route_id,
        shipping_type_id: result.shipping_type_id
      } as CartShippingCostView;
    },
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: itemIdsArray.length > 0, // Solo ejecutar si hay items seleccionados
  });
};
