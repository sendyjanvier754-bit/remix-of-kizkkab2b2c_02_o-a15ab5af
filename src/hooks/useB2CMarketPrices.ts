import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface B2CMarketPrice {
  source_product_id: string | null;
  sku: string;
  max_b2c_price: number;
  num_sellers: number;
  min_b2c_price: number;
  avg_b2c_price: number;
}

export interface ProductPVPReference {
  pvp_reference: number;
  pvp_source: 'market' | 'admin' | 'calculated' | 'none';
  num_b2c_sellers: number;
  min_market_price: number;
  max_market_price: number;
  is_synced_with_market: boolean;
}

export interface CartProfitProjection {
  total_investment: number;
  total_pvp_value: number;
  total_profit: number;
  avg_roi_percent: number;
  items_with_market_price: number;
  items_total: number;
}

/**
 * Hook to fetch B2C max prices for market reference
 */
export const useB2CMarketPrices = (productIds?: string[]) => {
  return useQuery({
    queryKey: ['b2c-market-prices', productIds],
    queryFn: async () => {
      if (!productIds || productIds.length === 0) {
        return new Map<string, B2CMarketPrice>();
      }

      const { data, error } = await (supabase as any)
        .from('b2c_max_prices')
        .select('*')
        .in('source_product_id', productIds);

      if (error) {
        console.error('Error fetching B2C market prices:', error);
        return new Map<string, B2CMarketPrice>();
      }

      // Create a map for quick lookup by product ID
      const priceMap = new Map<string, B2CMarketPrice>();
      (data || []).forEach((item: any) => {
        if (item.source_product_id) {
          priceMap.set(item.source_product_id, item as B2CMarketPrice);
        }
      });

      return priceMap;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    enabled: !!productIds && productIds.length > 0,
  });
};

/**
 * Hook to get enriched B2B products with market data
 */
export const useProductsB2BEnriched = (productIds?: string[]) => {
  return useQuery({
    queryKey: ['products-b2b-enriched', productIds],
    queryFn: async () => {
      let query = (supabase as any)
        .from('products_b2b_enriched')
        .select('*');

      if (productIds && productIds.length > 0) {
        query = query.in('id', productIds);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching enriched B2B products:', error);
        return [];
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !productIds || productIds.length > 0,
  });
};

/**
 * Get PVP reference for a single product
 */
export const getProductPVPReference = async (
  productId: string,
  productSku?: string,
  fallbackPrice?: number
): Promise<ProductPVPReference | null> => {
  try {
    const { data, error } = await (supabase.rpc as any)('get_reference_pvp', {
      p_product_id: productId,
      p_product_sku: productSku || null,
      p_fallback_price: fallbackPrice || null,
    });

    if (error) {
      console.error('Error getting PVP reference:', error);
      return null;
    }

    return (data?.[0] as ProductPVPReference) || null;
  } catch (error) {
    console.error('Error in getProductPVPReference:', error);
    return null;
  }
};

/**
 * Calculate cart profit projection using database function
 */
export const calculateCartProfit = async (
  cartItems: Array<{
    product_id: string;
    sku: string;
    cantidad: number;
    precio_b2b: number;
  }>
): Promise<CartProfitProjection | null> => {
  try {
    const { data, error } = await (supabase.rpc as any)('calculate_cart_projected_profit', {
      p_cart_items: cartItems,
    });

    if (error) {
      console.error('Error calculating cart profit:', error);
      return null;
    }

    return (data as any)?.[0] || null;
  } catch (error) {
    console.error('Error in calculateCartProfit:', error);
    return null;
  }
};

/**
 * Hook to calculate profit for cart items with caching
 */
export const useCartProfitProjection = (
  cartItems: Array<{
    productId: string;
    sku: string;
    cantidad: number;
    precioB2B: number;
  }>
) => {
  return useQuery({
    queryKey: ['cart-profit-projection', cartItems.map(i => `${i.productId}-${i.cantidad}`)],
    queryFn: async () => {
      if (cartItems.length === 0) {
        return {
          total_investment: 0,
          total_pvp_value: 0,
          total_profit: 0,
          avg_roi_percent: 0,
          items_with_market_price: 0,
          items_total: 0,
        };
      }

      const formattedItems = cartItems.map(item => ({
        product_id: item.productId,
        sku: item.sku,
        cantidad: item.cantidad,
        precio_b2b: item.precioB2B,
      }));

      const result = await calculateCartProfit(formattedItems);
      return result || {
        total_investment: cartItems.reduce((sum, i) => sum + i.precioB2B * i.cantidad, 0),
        total_pvp_value: cartItems.reduce((sum, i) => sum + i.precioB2B * i.cantidad * 1.3, 0),
        total_profit: cartItems.reduce((sum, i) => sum + i.precioB2B * i.cantidad * 0.3, 0),
        avg_roi_percent: 30,
        items_with_market_price: 0,
        items_total: cartItems.length,
      };
    },
    staleTime: 1000 * 30, // 30 seconds cache for reactive updates
    enabled: cartItems.length > 0,
  });
};
