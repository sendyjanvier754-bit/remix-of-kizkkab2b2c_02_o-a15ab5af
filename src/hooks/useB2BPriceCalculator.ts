import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useB2BMarginRanges, B2BMarginRange, B2BPriceResult } from './useB2BMarginRanges';
import { useRoutePricing } from './useRoutePricing';

export interface ProductLogisticsInfo {
  routeId: string | null;
  routeName: string;
  logisticsCost: number;
  estimatedDays: { min: number; max: number };
  originCountry: string;
  destinationCountry: string;
}

export interface B2BCalculatedPrice {
  // Base costs
  factoryCost: number;
  
  // Margin calculation (Protection Rule)
  marginRange: B2BMarginRange | null;
  marginPercent: number;
  marginValue: number;
  subtotalWithMargin: number; // Factory + Margin
  
  // Logistics
  logistics: ProductLogisticsInfo | null;
  logisticsCost: number;
  
  // Category fees
  categoryFees: number;
  
  // Final price
  finalB2BPrice: number;
  
  // Suggested PVP
  suggestedPVP: number;
  profitAmount: number;
  roiPercent: number;
}

export interface ProductForCalculation {
  id: string;
  factoryCost: number; // precio_mayorista / costo de fábrica
  categoryId?: string;
  shippingOriginId?: string;
  weight?: number; // Weight in kg for logistics calculation
}

/**
 * Hook that integrates the B2B price engine with logistics
 * Implements the "Protection Rule" where margin is applied to factory cost
 * before adding logistics costs
 */
export function useB2BPriceCalculator(destinationCountryCode?: string) {
  const { useActiveMarginRanges, calculateB2BPriceWithRanges, findMarginRangeForCost } = useB2BMarginRanges();
  const { data: marginRanges = [] } = useActiveMarginRanges();
  const { routes, calculateRouteCost, getRouteSummary } = useRoutePricing();
  
  // Fetch category shipping rates
  const { data: categoryRates = [] } = useQuery({
    queryKey: ['category-shipping-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_shipping_rates')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch shipping origins for products
  const { data: shippingOrigins = [] } = useQuery({
    queryKey: ['shipping-origins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_origins')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch default destination (user's market or default)
  const { data: defaultDestination } = useQuery({
    queryKey: ['default-destination', destinationCountryCode],
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
      // Default to first active destination (e.g., Haiti)
      const { data } = await supabase
        .from('destination_countries')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();
      return data;
    },
  });

  /**
   * Calculate category fees for a product
   */
  const getCategoryFees = (categoryId: string | undefined, baseCost: number): number => {
    if (!categoryId) return 0;
    
    const rate = categoryRates.find(r => r.category_id === categoryId);
    if (!rate) return 0;
    
    const fixedFee = rate.fixed_fee || 0;
    const percentageFee = (baseCost * (rate.percentage_fee || 0)) / 100;
    
    return Math.round((fixedFee + percentageFee) * 100) / 100;
  };

  /**
   * Find route for destination
   */
  const findRouteForDestination = (destinationCode?: string): string | null => {
    if (!destinationCode || routes.length === 0) return null;
    
    const route = routes.find(r => 
      r.countryCode?.toUpperCase() === destinationCode.toUpperCase() && r.isActive
    );
    
    return route?.id || null;
  };

  /**
   * Calculate logistics for a product
   */
  const calculateLogistics = (
    routeId: string | null,
    weight: number = 0.5 // Default weight 0.5 kg if not specified
  ): ProductLogisticsInfo | null => {
    if (!routeId) return null;
    
    const summary = getRouteSummary(routeId);
    const costInfo = calculateRouteCost(routeId, weight);
    
    if (!summary) return null;
    
    return {
      routeId,
      routeName: summary.name,
      logisticsCost: Math.round(costInfo.cost * 100) / 100,
      estimatedDays: costInfo.days,
      originCountry: 'China',
      destinationCountry: summary.name.split('→').pop()?.trim() || 'Destino',
    };
  };

  /**
   * Calculate B2B price for a single product
   * Applies the Protection Rule: Margin on factory cost, then add logistics
   */
  const calculateProductPrice = (
    product: ProductForCalculation,
    destinationCode?: string
  ): B2BCalculatedPrice => {
    const factoryCost = product.factoryCost;
    const destCode = destinationCode || destinationCountryCode || defaultDestination?.code;
    
    // 1. Find applicable margin range
    const marginRange = findMarginRangeForCost(factoryCost, marginRanges);
    const marginPercent = marginRange?.margin_percent ?? 30;
    
    // 2. Apply margin to factory cost (Protection Rule)
    const marginValue = (factoryCost * marginPercent) / 100;
    const subtotalWithMargin = factoryCost + marginValue;
    
    // 3. Calculate logistics
    const routeId = findRouteForDestination(destCode);
    const logistics = calculateLogistics(routeId, product.weight);
    const logisticsCost = logistics?.logisticsCost || 0;
    
    // 4. Calculate category fees
    const categoryFees = getCategoryFees(product.categoryId, factoryCost);
    
    // 5. Calculate final B2B price
    const finalB2BPrice = Math.round((subtotalWithMargin + logisticsCost + categoryFees) * 100) / 100;
    
    // 6. Calculate suggested PVP (150% margin over B2B price - 2.5x multiplier)
    const suggestedPVP = Math.round(finalB2BPrice * 2.5 * 100) / 100;
    const profitAmount = Math.round((suggestedPVP - finalB2BPrice) * 100) / 100;
    const roiPercent = finalB2BPrice > 0 ? Math.round((profitAmount / finalB2BPrice) * 100 * 10) / 10 : 0;
    
    return {
      factoryCost,
      marginRange,
      marginPercent,
      marginValue: Math.round(marginValue * 100) / 100,
      subtotalWithMargin: Math.round(subtotalWithMargin * 100) / 100,
      logistics,
      logisticsCost,
      categoryFees,
      finalB2BPrice,
      suggestedPVP,
      profitAmount,
      roiPercent,
    };
  };

  /**
   * Batch calculate prices for multiple products
   */
  const calculateBatchPrices = (
    products: ProductForCalculation[],
    destinationCode?: string
  ): Map<string, B2BCalculatedPrice> => {
    const results = new Map<string, B2BCalculatedPrice>();
    
    for (const product of products) {
      results.set(product.id, calculateProductPrice(product, destinationCode));
    }
    
    return results;
  };

  /**
   * Get current destination info
   */
  const currentDestination = useMemo(() => ({
    code: destinationCountryCode || defaultDestination?.code || 'HT',
    name: defaultDestination?.name || 'Haití',
    currency: defaultDestination?.currency || 'USD',
  }), [destinationCountryCode, defaultDestination]);

  return {
    marginRanges,
    routes,
    categoryRates,
    shippingOrigins,
    currentDestination,
    calculateProductPrice,
    calculateBatchPrices,
    calculateLogistics,
    getCategoryFees,
    findRouteForDestination,
  };
}
