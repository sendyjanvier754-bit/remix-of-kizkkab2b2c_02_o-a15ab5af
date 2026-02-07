import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useB2BMarginRanges } from './useB2BMarginRanges';
import { B2BCartItem } from './useB2BCartItems';
import { useLogisticsDataForItems, useShippingRoutes, useShippingZones } from './useLogisticsDataForItems';

export interface CartItemLogistics {
  itemId: string;
  productId: string;
  
  // Factory cost breakdown
  factoryCost: number;
  marginPercent: number;
  marginValue: number;
  subtotalWithMargin: number;
  
  // Logistics
  logisticsCost: number;
  categoryFees: number;
  
  // Final prices
  finalUnitPrice: number;
  finalTotalPrice: number;
  
  // Delivery estimate
  estimatedDays: { min: number; max: number };
  routeName: string;
}

export interface CartLogisticsSummary {
  // Items with logistics calculated
  itemsLogistics: Map<string, CartItemLogistics>;
  
  // Totals
  totalFactoryCost: number;
  totalMarginValue: number;
  totalLogisticsCost: number;
  totalCategoryFees: number;
  totalFinalPrice: number;
  
  // Delivery
  estimatedDeliveryDays: { min: number; max: number };
  routeName: string;
  
  // Meta
  itemsCount: number;
  totalQuantity: number;
  
  // New fields for weight handling
  hasWeight?: boolean;
  shippingCostLabel?: string; // "-" if no weight configured
}

/**
 * Hook to calculate logistics and pricing for B2B cart items
 * NOW: Uses the new V_LOGISTICS_DATA and fn_calculate_shipping_cost system
 * Shows "-" when products don't have weight configured
 */
export function useB2BCartLogistics(items: B2BCartItem[], destinationCountryCode?: string) {
  const { useActiveMarginRanges, findMarginRangeForCost } = useB2BMarginRanges();
  const { data: marginRanges = [] } = useActiveMarginRanges();
  
  // Get available routes and zones for defaults
  const { routes } = useShippingRoutes();
  const { zones } = useShippingZones();
  
  // Get first active route as default
  const defaultRouteId = useMemo(() => routes?.[0]?.id || null, [routes]);
  
  // Get first active zone as default (prefer Haiti if available)
  const defaultZoneId = useMemo(() => {
    const haitiZone = zones?.find(z => z.country?.toUpperCase() === 'HT');
    return haitiZone?.id || zones?.[0]?.id || null;
  }, [zones]);
  
  // Fetch product details for factory costs and margins
  const productIds = useMemo(() => 
    [...new Set(items.map(item => item.productId).filter(Boolean))],
    [items]
  );
  
  const variantIds = useMemo(() => 
    [...new Set(items.map(item => item.variantId).filter(Boolean))],
    [items]
  );
  
  // Fetch variant prices from v_variantes_con_precio_b2b
  const { data: variants = [] } = useQuery({
    queryKey: ['cart-variants-details', variantIds],
    queryFn: async () => {
      if (variantIds.length === 0) return [];
      
      const { data, error } = await (supabase as any)
        .from('v_variantes_con_precio_b2b')
        .select('id, product_id, precio_b2b_final, moq')
        .in('id', variantIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: variantIds.length > 0,
  });
  
  // Fetch product prices from v_productos_con_precio_b2b (fallback for non-variant items)
  const { data: products = [] } = useQuery({
    queryKey: ['cart-products-details', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      const { data, error } = await (supabase as any)
        .from('v_productos_con_precio_b2b')
        .select('id, precio_b2b, categoria_id')
        .in('id', productIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });
  
  // Fetch category shipping rates
  const { data: categoryRates = [] } = useQuery({
    queryKey: ['category-shipping-rates-cart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_shipping_rates')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Get shipping costs from unified v_logistics_data view
  const itemsForLogistics = useMemo(() => 
    items.map(item => ({
      productId: item.productId,
      variantId: item.variantId
    })),
    [items]
  );
  
  const { 
    result: shippingCostResult, 
    isLoading: shippingLoading, 
    error: shippingError,
  } = useLogisticsDataForItems(itemsForLogistics);
  
  // Extract itemCosts from the result
  const itemCosts = useMemo(() => 
    shippingCostResult?.itemCosts || [],
    [shippingCostResult?.itemCosts]
  );

  // Calculate logistics for all cart items
  const cartLogistics = useMemo((): CartLogisticsSummary => {
    const itemsLogistics = new Map<string, CartItemLogistics>();
    let totalFactoryCost = 0;
    let totalMarginValue = 0;
    let totalLogisticsCost = 0;
    let totalCategoryFees = 0;
    let totalFinalPrice = 0;
    let totalQuantity = 0;
    let maxDeliveryMin = 0;
    let maxDeliveryMax = 0;
    let routeName = 'Envío Estándar';
    
    // Check if we have shipping cost data
    const hasShippingCost = itemCosts && itemCosts.length === items.length;
    
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      const variant = item.variantId ? variants.find((v: any) => v.id === item.variantId) : null;
      
      // PRIORITY: variant price > product price > item.precioB2B
      let factoryCost = item.precioB2B;
      if (variant?.precio_b2b_final != null) {
        factoryCost = variant.precio_b2b_final;
      } else if (product?.precio_b2b != null) {
        factoryCost = product.precio_b2b;
      }
      
      const categoryId = product?.categoria_id;
      
      // 1. Calculate margin
      const marginRange = findMarginRangeForCost(factoryCost, marginRanges);
      const marginPercent = marginRange?.margin_percent ?? 30;
      const marginValue = (factoryCost * marginPercent) / 100;
      const subtotalWithMargin = factoryCost + marginValue;
      
      // 2. Get logistics cost - Use individual item cost from itemCosts
      let logisticsCost = 0;
      if (hasShippingCost && itemCosts) {
        const itemCost = itemCosts.find(
          ic => ic.productId === item.productId && ic.variantId === (item.variantId || undefined)
        );
        if (itemCost) {
          logisticsCost = itemCost.shippingCost;
        }
      }
      
      // 3. Category fees
      let categoryFees = 0;
      if (categoryId) {
        const rate = categoryRates.find(r => r.category_id === categoryId);
        if (rate) {
          categoryFees = (rate.fixed_fee || 0) + (factoryCost * (rate.percentage_fee || 0)) / 100;
          categoryFees = Math.round(categoryFees * 100) / 100;
        }
      }
      
      // 4. Calculate final price per unit
      const finalUnitPrice = Math.round((subtotalWithMargin + logisticsCost + categoryFees) * 100) / 100;
      const finalTotalPrice = Math.round(finalUnitPrice * item.cantidad * 100) / 100;
      
      itemsLogistics.set(item.id, {
        itemId: item.id,
        productId: item.productId,
        factoryCost,
        marginPercent,
        marginValue: Math.round(marginValue * 100) / 100,
        subtotalWithMargin: Math.round(subtotalWithMargin * 100) / 100,
        logisticsCost,
        categoryFees,
        finalUnitPrice,
        finalTotalPrice,
        estimatedDays: { min: 7, max: 14 }, // Default estimate
        routeName,
      });
      
      // Accumulate totals
      totalFactoryCost += factoryCost * item.cantidad;
      totalMarginValue += marginValue * item.cantidad;
      totalLogisticsCost += logisticsCost * item.cantidad;
      totalCategoryFees += categoryFees * item.cantidad;
      totalFinalPrice += finalTotalPrice;
      totalQuantity += item.cantidad;
      
      maxDeliveryMin = 7;
      maxDeliveryMax = 14;
    }
    
    // Get total shipping cost directly from v_logistics_data result
    const actualTotalShippingCost = shippingCostResult?.totalCost || 0;
    
    return {
      itemsLogistics,
      totalFactoryCost: Math.round(totalFactoryCost * 100) / 100,
      totalMarginValue: Math.round(totalMarginValue * 100) / 100,
      totalLogisticsCost: Math.round(actualTotalShippingCost * 100) / 100,
      totalCategoryFees: Math.round(totalCategoryFees * 100) / 100,
      totalFinalPrice: Math.round(totalFinalPrice * 100) / 100,
      estimatedDeliveryDays: { min: maxDeliveryMin, max: maxDeliveryMax },
      routeName,
      itemsCount: items.length,
      totalQuantity,
      hasWeight: hasShippingCost || false,
      shippingCostLabel: undefined // Always show cost, never "-"
    };
  }, [items, products, marginRanges, categoryRates, shippingCostResult, itemCosts, findMarginRangeForCost]);
  
  return {
    ...cartLogistics,
    isCalculating: products.length === 0 && productIds.length > 0 || shippingLoading,
  };
}
