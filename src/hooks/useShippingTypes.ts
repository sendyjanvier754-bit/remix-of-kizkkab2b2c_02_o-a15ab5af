import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShippingType {
  id: string;
  route_id: string;
  tier_type: string; // e.g. 'standard', 'express', 'economy', 'fast', 'priority', or any custom value
  tier_name: string;
  custom_tier_name?: string | null;
  transport_type: 'maritimo' | 'aereo' | 'terrestre';
  // Tramo A: China → Puerto
  tramo_a_cost_per_kg: number;
  tramo_a_cost_per_lb: number; // Calculado: kg × 2.20462
  tramo_a_eta_min: number;
  tramo_a_eta_max: number;
  // Tramo B: Puerto → Destino
  tramo_b_cost_per_kg: number;
  tramo_b_cost_per_lb: number; // Calculado: kg × 2.20462
  tramo_b_eta_min: number;
  tramo_b_eta_max: number;
  is_active: boolean;
  priority_order: number;
  // Campos calculados/legacy para compatibilidad
  display_name: string;
  extra_cost_fixed: number;
  extra_cost_percent: number;
}

export interface ShippingCostResult {
  weight_rounded_kg: number;
  base_cost: number;
  extra_cost: number;
  total_cost_with_type: number;
  shipping_type_name?: string | null;
  shipping_type_display?: string | null;
  eta_min?: number;
  eta_max?: number;
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
export const useShippingTypes = (routeId?: string, countryId?: string) => {
  const [shippingTypes, setShippingTypes] = useState<ShippingType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ShippingType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available shipping types for the route/country (or all if neither specified)
  useEffect(() => {
    const fetchShippingTypes = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Build query - filter by routeId, countryId, or get all active tiers
        let query = supabase
          .from('shipping_tiers')
          .select('*')
          .eq('is_active', true)
          .order('priority_order', { ascending: true });

        if (routeId) {
          // Filter by specific route
          query = query.eq('route_id', routeId);
        } else if (countryId) {
          // Filter by destination country — get all route IDs for that country first
          const { data: routes } = await supabase
            .from('shipping_routes')
            .select('id')
            .eq('destination_country_id', countryId)
            .eq('is_active', true);
          const routeIds = (routes || []).map(r => r.id);
          if (routeIds.length > 0) {
            query = query.in('route_id', routeIds);
          }
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          throw queryError;
        }

        console.log('🔄 Shipping tiers fetched from DB:', data);  // Debug log

        // Map shipping_tiers to ShippingType format
        const mappedTypes: ShippingType[] = (data || []).map((tier: any) => ({
          ...tier,
          transport_type: tier.transport_type as 'aereo' | 'maritimo' | 'terrestre',
          display_name: tier.custom_tier_name || tier.tier_name,
          extra_cost_fixed: 0, // Legacy - no longer used
          extra_cost_percent: 0, // Legacy - no longer used
          // Calcular costos en ambas unidades para mostrar en UI
          tramo_a_cost_per_lb: Number((tier.tramo_a_cost_per_kg * 2.20462).toFixed(4)),
          tramo_b_cost_per_lb: Number((tier.tramo_b_cost_per_kg * 2.20462).toFixed(4)),
        }));

        console.log('✅ Mapped shipping types with both units:', mappedTypes);  // Debug log

        setShippingTypes(mappedTypes);

        // Set first type as default if available
        if (mappedTypes.length > 0 && !selectedTypeId) {
          setSelectedTypeId(mappedTypes[0].id);
          setSelectedType(mappedTypes[0]);
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
  }, [routeId, countryId]); // ✅ Re-ejecuta cuando cambia routeId o countryId

  // ============================================================================
  // 🔴 REALTIME SUBSCRIPTION - Auto-actualización cuando cambian los tiers
  // ============================================================================
  useEffect(() => {
    console.log('🔴 Setting up realtime subscription for shipping_tiers');
    
    // Create channel for shipping_tiers updates
    const channel = supabase
      .channel('shipping_tiers_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'shipping_tiers',
          // Opcional: filtrar solo por routeId si está presente
          ...(routeId ? { filter: `route_id=eq.${routeId}` } : {}),
        },
        (payload) => {
          console.log('🔴 Shipping tier changed:', payload);
          
          // Re-fetch shipping types when any tier changes
          const refetchTypes = async () => {
            try {
              let query = supabase
                .from('shipping_tiers')
                .select('*')
                .eq('is_active', true)
                .order('priority_order', { ascending: true });

              if (routeId) {
                query = query.eq('route_id', routeId);
              }

              const { data, error: queryError } = await query;

              if (queryError) {
                console.error('Error refetching shipping types:', queryError);
                return;
              }

              const mappedTypes: ShippingType[] = (data || []).map(tier => ({
                ...tier,
                display_name: tier.custom_tier_name || tier.tier_name,
                extra_cost_fixed: 0,
                extra_cost_percent: 0,
                tramo_a_cost_per_lb: Number((tier.tramo_a_cost_per_kg * 2.20462).toFixed(4)),
                tramo_b_cost_per_lb: Number((tier.tramo_b_cost_per_kg * 2.20462).toFixed(4)),
              }));

              console.log('✅ Shipping types auto-updated from realtime:', mappedTypes);
              setShippingTypes(mappedTypes);
              
              // Actualizar selectedType si está seleccionado
              if (selectedTypeId) {
                const updatedType = mappedTypes.find(t => t.id === selectedTypeId);
                if (updatedType) {
                  setSelectedType(updatedType);
                }
              }
            } catch (err) {
              console.error('Error in realtime refetch:', err);
            }
          };

          refetchTypes();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      console.log('🔴 Cleaning up realtime subscription for shipping_tiers');
      supabase.removeChannel(channel);
    };
  }, [routeId, selectedTypeId]); // Re-subscribe if routeId or selectedTypeId changes

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
   * @deprecated This functionality may not be supported without a route
   */
  const calculateProductCost = useCallback(
    async (weightKg: number): Promise<ShippingProductCostResult | null> => {
      console.warn('calculateProductCost is deprecated - use calculateCartCost with a shipping tier instead');
      return null;
    },
    []
  );

  /**
   * Calculate shipping cost for cart with weight rounding and surcharges
   * Rounds weight up to nearest kg and applies selected type surcharge
   */
  const calculateCartCost = useCallback(
    async (totalWeightKg: number, shippingTypeId?: string): Promise<ShippingCostResult | null> => {
      if (!shippingTypeId) {
        console.warn('Shipping type ID required for cost calculation');
        return null;
      }

      try {
        // ✅ NUEVO: Solo requiere shipping_type_id (no route_id)
        const { data, error: rpcError } = await supabase
          .rpc('calculate_shipping_cost_cart', {
            p_total_weight_kg: totalWeightKg,
            p_shipping_type_id: shippingTypeId,
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
    [] // No dependencies - shipping type ID passed as parameter
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
