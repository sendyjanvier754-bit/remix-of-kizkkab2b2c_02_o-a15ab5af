import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useB2BMarginRanges } from './useB2BMarginRanges';
import { useRoutePricing } from './useRoutePricing';
import { B2BCartItem } from './useB2BCartItems';

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
}

/**
 * Hook to calculate logistics and pricing for B2B cart items
 * Uses the Protection Rule: Margin applied to factory cost before logistics
 */
export function useB2BCartLogistics(items: B2BCartItem[], destinationCountryCode?: string) {
  const { useActiveMarginRanges, findMarginRangeForCost } = useB2BMarginRanges();
  const { data: marginRanges = [] } = useActiveMarginRanges();
  const { routes, calculateRouteCost, getRouteSummary } = useRoutePricing();
  
  // Fetch product details for factory costs
  const productIds = useMemo(() => 
    [...new Set(items.map(item => item.productId).filter(Boolean))],
    [items]
  );
  
  const { data: products = [] } = useQuery({
    queryKey: ['cart-products-details', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('v_productos_con_precio_b2b')
        .select('id, precio_b2b, categoria_id, peso_kg')
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
  
  // Fetch default destination
  const { data: defaultDestination } = useQuery({
    queryKey: ['default-destination-cart', destinationCountryCode],
    queryFn: async () => {
      if (destinationCountryCode) {
        const { data } = await supabase
          .from('destination_countries')
          .select('*')
          .eq('code', destinationCountryCode)
          .eq('is_active', true)
          .single();
        return data;
      }
      const { data } = await supabase
        .from('destination_countries')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();
      return data;
    },
  });

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
    let routeName = '';
    
    // Find default route
    const destCode = destinationCountryCode || defaultDestination?.code || 'HT';
    const route = routes.find(r => 
      r.countryCode?.toUpperCase() === destCode.toUpperCase() && r.isActive
    );
    const routeId = route?.id || null;
    const summary = routeId ? getRouteSummary(routeId) : null;
    routeName = summary?.name || 'Ruta estándar';
    
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      const factoryCost = product?.precio_b2b || item.precioB2B;
      const weight = product?.peso_kg || 0.5;
      const categoryId = product?.categoria_id;
      
      // 1. Find margin range
      const marginRange = findMarginRangeForCost(factoryCost, marginRanges);
      const marginPercent = marginRange?.margin_percent ?? 30;
      const marginValue = (factoryCost * marginPercent) / 100;
      const subtotalWithMargin = factoryCost + marginValue;
      
      // 2. Calculate logistics per item
      let logisticsCost = 0;
      let estimatedDays = { min: 7, max: 21 };
      
      if (routeId) {
        const costInfo = calculateRouteCost(routeId, weight);
        logisticsCost = Math.round(costInfo.cost * 100) / 100;
        estimatedDays = costInfo.days;
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
        estimatedDays,
        routeName,
      });
      
      // Accumulate totals
      totalFactoryCost += factoryCost * item.cantidad;
      totalMarginValue += marginValue * item.cantidad;
      totalLogisticsCost += logisticsCost * item.cantidad;
      totalCategoryFees += categoryFees * item.cantidad;
      totalFinalPrice += finalTotalPrice;
      totalQuantity += item.cantidad;
      
      // Track max delivery time
      maxDeliveryMin = Math.max(maxDeliveryMin, estimatedDays.min);
      maxDeliveryMax = Math.max(maxDeliveryMax, estimatedDays.max);
    }
    
    return {
      itemsLogistics,
      totalFactoryCost: Math.round(totalFactoryCost * 100) / 100,
      totalMarginValue: Math.round(totalMarginValue * 100) / 100,
      totalLogisticsCost: Math.round(totalLogisticsCost * 100) / 100,
      totalCategoryFees: Math.round(totalCategoryFees * 100) / 100,
      totalFinalPrice: Math.round(totalFinalPrice * 100) / 100,
      estimatedDeliveryDays: { min: maxDeliveryMin || 7, max: maxDeliveryMax || 21 },
      routeName,
      itemsCount: items.length,
      totalQuantity,
    };
  }, [items, products, marginRanges, categoryRates, routes, destinationCountryCode, defaultDestination, findMarginRangeForCost, calculateRouteCost, getRouteSummary]);
  
  return {
    ...cartLogistics,
    isCalculating: products.length === 0 && productIds.length > 0,
  };
}
