import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  cantidad: number;
  precioB2B: number;
  // These might come from product data
  weight_kg?: number;
}

export interface ItemCostResult {
  productId: string;
  variantId?: string;
  weight_kg: number;
  shippingCost: number; // Already distributed proportionally by weight
}

export interface ShippingCalculationResult {
  totalWeight_kg: number;
  totalCost: number;
  itemCosts: ItemCostResult[];
  isEmpty: boolean;
}

/**
 * Hook to calculate shipping costs for cart items with proportional distribution
 * 
 * Logic:
 * 1. Get weight for each item (from product/variant data)
 * 2. Sum all weights WITHOUT rounding individual items
 * 3. Make ONE RPC call with total weight (CEIL() applied in DB)
 * 4. Distribute total cost back to items by weight ratio
 * 
 * Example:
 * - Camiseta: 0.600 kg, cost $8.31
 * - Tanga: 0.300 kg, cost $4.16
 * - Total: 0.900 kg → CEIL(0.9) = 1.0 kg → RPC returns $12.47
 * - Distribution: Camiseta 66.7% = $8.31, Tanga 33.3% = $4.16
 */
export const useShippingCostCalculationForCart = (items: CartItem[]) => {
  const [result, setResult] = useState<ShippingCalculationResult>({
    totalWeight_kg: 0,
    totalCost: 0,
    itemCosts: [],
    isEmpty: items.length === 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      setResult({
        totalWeight_kg: 0,
        totalCost: 0,
        itemCosts: [],
        isEmpty: true,
      });
      return;
    }

    const calculateShipping = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Fetch weight data for all items
        const productIds = [...new Set(items.map(item => item.productId))];
        const variantIds = items.filter(item => item.variantId).map(item => item.variantId!);

        // Get product weights
        let productsData: any[] = [];
        if (productIds.length > 0) {
          const { data } = await supabase
            .from('products')
            .select('id, weight_kg, peso_g')
            .in('id', productIds);
          productsData = data || [];
        }

        // Get variant weights (variants can have their own weight)
        let variantsData: any[] = [];
        if (variantIds.length > 0) {
          const { data } = await supabase
            .from('product_variants')
            .select('id, product_id, weight_kg, peso_g')
            .in('id', variantIds);
          variantsData = data || [];
        }

        // Helper to normalize weight to KG
        const getWeightKg = (item: any): number => {
          // Priority: weight_kg field
          if (item.weight_kg && item.weight_kg > 0) {
            return item.weight_kg;
          }
          // Fallback: peso_g field (convert to kg)
          if (item.peso_g && item.peso_g > 0) {
            return item.peso_g / 1000;
          }
          // Default fallback: 300g (0.3 kg) for items without weight
          return 0.3;
        };

        // Step 2: Assign weights to cart items and calculate total (NO individual rounding)
        let totalWeightKg = 0;
        const itemWeights: Array<{
          productId: string;
          variantId?: string;
          weight_kg: number;
          quantity: number;
        }> = [];

        items.forEach(cartItem => {
          let itemWeight = 0.3; // Default fallback

          // Check if item has variant
          if (cartItem.variantId) {
            const variant = variantsData.find(v => v.id === cartItem.variantId);
            if (variant) {
              itemWeight = getWeightKg(variant);
            } else {
              // Fallback to product weight if variant doesn't have weight
              const product = productsData.find(p => p.id === cartItem.productId);
              if (product) {
                itemWeight = getWeightKg(product);
              }
            }
          } else {
            // No variant - use product weight
            const product = productsData.find(p => p.id === cartItem.productId);
            if (product) {
              itemWeight = getWeightKg(product);
            }
          }

          itemWeights.push({
            productId: cartItem.productId,
            variantId: cartItem.variantId,
            weight_kg: itemWeight,
            quantity: cartItem.cantidad,
          });

          // Add to total WITHOUT rounding
          totalWeightKg += itemWeight;
        });

        // Step 3: Fetch shipping rates from database
        // Get default routing: Haití ← China (STANDARD tier)
        let costPerKg = 3.50;  // Fallback default
        let costPerLb = 1.80;  // Fallback default
        let zoneSurcharge = 5.00;  // Fallback default

        try {
          // Get the default shipping route (Haiti from China)
          const { data: routeData } = await supabase
            .from('shipping_routes')
            .select('id')
            .eq('origin', 'CHINA')
            .eq('destination', 'HAITI')
            .single();

          if (routeData) {
            // Get standard tier costs for this route
          const { data: tierData } = await (supabase as any)
              .from('shipping_tiers')
              .select('tramo_a_cost_per_kg, tramo_b_cost_per_lb')
              .eq('shipping_route_id', routeData.id)
              .eq('tier_type', 'standard')
              .single();

            if (tierData) {
              costPerKg = tierData.tramo_a_cost_per_kg;
              costPerLb = tierData.tramo_b_cost_per_lb;
            }
          }

          // Get the default zone surcharge (Haiti - with fallback)
          const { data: zoneData } = await supabase
            .from('shipping_zones')
            .select('final_delivery_surcharge')
            .or('zone_name.eq.HAITI_CENTRO,zone_name.ilike.%HAITI%')
            .eq('is_active', true)
            .order('final_delivery_surcharge', { ascending: true })
            .limit(1)
            .single();

          if (zoneData) {
            zoneSurcharge = zoneData.final_delivery_surcharge;
          }
        } catch (err) {
          console.warn('Error fetching shipping rates from DB, using defaults:', err);
          // Fallback values remain in place
        }

        // Calculate total shipping cost
        const factorableWeight = Math.ceil(totalWeightKg);
        const poundsPerKg = 2.20462;
        
        const totalCost = 
          (factorableWeight * costPerKg) + 
          (factorableWeight * poundsPerKg * costPerLb) + 
          zoneSurcharge;

        // Step 4: Distribute cost proportionally by weight
        const itemCosts: ItemCostResult[] = itemWeights.map(item => {
          const weightRatio = totalWeightKg > 0 ? item.weight_kg / totalWeightKg : 0;
          const shippingCostPerUnit = totalCost * weightRatio;

          return {
            productId: item.productId,
            variantId: item.variantId,
            weight_kg: item.weight_kg,
            shippingCost: shippingCostPerUnit,
          };
        });

        setResult({
          totalWeight_kg: totalWeightKg,
          totalCost: totalCost,
          itemCosts: itemCosts,
          isEmpty: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error calculating shipping';
        setError(message);
        console.error('Shipping calculation error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    calculateShipping();
  }, [items]);

  return { result, isLoading, error };
};
