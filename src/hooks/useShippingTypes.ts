import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShippingType {
  id: string;
  shipping_route_id: string;
  type: string; // 'STANDARD', 'EXPRESS', 'PRIORITY'
  display_name: string;
  extra_cost_fixed: number;
  extra_cost_percent: number;
  is_active: boolean;
  priority_order: number;
}

export interface ShippingCostResult {
  weight_rounded_kg: number;
  base_cost: number;
  extra_cost: number;
  total_cost_with_type: number;
  shipping_type_name?: string | null;
  shipping_type_display?: string | null;
}

export interface ShippingProductCostResult {
  weight_kg: number;
  base_cost: number;
}

/**
 * Hook to manage shipping types and calculate shipping costs
 * 
 * Features:
 * - Fetch available shipping types for a given route
 * - Calculate cost for individual products (with actual weight, no rounding)
 * - Calculate cost for cart with weight rounding and surcharges
 * - Select and manage shipping type preferences
 */
export const useShippingTypes = (routeId?: string) => {
  const [shippingTypes, setShippingTypes] = useState<ShippingType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ShippingType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available shipping types for the route
  useEffect(() => {
    if (!routeId) {
      setShippingTypes([]);
      return;
    }

    const fetchShippingTypes = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('shipping_type_configs')
          .select('*')
          .eq('shipping_route_id', routeId)
          .eq('is_active', true)
          .order('priority_order', { ascending: true });

        if (queryError) {
          throw queryError;
        }

        setShippingTypes(data || []);

        // Set first type as default if available
        if (data && data.length > 0 && !selectedTypeId) {
          setSelectedTypeId(data[0].id);
          setSelectedType(data[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error fetching shipping types';
        setError(message);
        console.error('Shipping types fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShippingTypes();
  }, [routeId]);

  // Update selected type when selectedTypeId changes
  useEffect(() => {
    if (selectedTypeId) {
      const type = shippingTypes.find(t => t.id === selectedTypeId);
      setSelectedType(type || null);
    } else {
      setSelectedType(null);
    }
  }, [selectedTypeId, shippingTypes]);

  /**
   * Calculate shipping cost for a single product
   * Uses actual weight (no rounding)
   */
  const calculateProductCost = useCallback(
    async (weightKg: number): Promise<ShippingProductCostResult | null> => {
      if (!routeId) {
        console.warn('Route ID not provided');
        return null;
      }

      try {
        const { data, error: rpcError } = await supabase
          .rpc('calculate_shipping_cost', {
            route_id: routeId,
            weight_kg: weightKg,
          });

        if (rpcError) {
          throw rpcError;
        }

        if (!data || data.length === 0) {
          return null;
        }

        return {
          weight_kg: data[0].weight_kg,
          base_cost: parseFloat(data[0].base_cost),
        };
      } catch (err) {
        console.error('Error calculating product shipping cost:', err);
        return null;
      }
    },
    [routeId]
  );

  /**
   * Calculate shipping cost for cart with weight rounding and surcharges
   * Rounds weight up to nearest kg and applies selected type surcharge
   */
  const calculateCartCost = useCallback(
    async (totalWeightKg: number, shippingTypeId?: string): Promise<ShippingCostResult | null> => {
      if (!routeId) {
        console.warn('Route ID not provided');
        return null;
      }

      try {
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
          return null;
        }

        return {
          weight_rounded_kg: parseFloat(data[0].weight_rounded_kg),
          base_cost: parseFloat(data[0].base_cost),
          extra_cost: parseFloat(data[0].extra_cost),
          total_cost_with_type: parseFloat(data[0].total_cost_with_type),
          shipping_type_name: data[0].shipping_type_name,
          shipping_type_display: data[0].shipping_type_display,
        };
      } catch (err) {
        console.error('Error calculating cart shipping cost:', err);
        return null;
      }
    },
    [routeId]
  );

  return {
    // State
    shippingTypes,
    selectedTypeId,
    selectedType,
    isLoading,
    error,

    // Actions
    setSelectedTypeId,
    calculateProductCost,
    calculateCartCost,
  };
};
