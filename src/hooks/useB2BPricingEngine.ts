import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Re-export V2 engine for new implementations
export { useB2BPricingEngineV2 } from './useB2BPricingEngineV2';

/**
 * MOTOR DE PRECIO V1: Independiente de logística (LEGACY)
 * 
 * Para cálculos multitramo con conversión de unidades, usar useB2BPricingEngineV2
 * 
 * Responsabilidades V1:
 * - Calcular precio base (costo + margen + fees)
 * - NO depende de rutas ni logística
 * - Retorna objeto limpio con breakdown de precios
 * 
 * Uso:
 * const { getProductBasePrice, getProductsByCategory } = useB2BPricingEngine();
 * const price = getProductBasePrice(product);
 */

export interface ProductBasePrice {
  product_id: string;
  sku_interno: string;
  nombre: string;
  costo_fabrica: number;
  precio_base: number;
  margin_value: number;
  platform_fee: number;
  weight_kg: number;
  weight_g?: number;
  market_id: string;
  market_name: string;
}

export interface PriceBreakdown {
  costo_fabrica: number;
  margen_aplicado: number;
  fee_plataforma: number;
  precio_base: number;
  porcentaje_margen: number;
}

export function useB2BPricingEngine() {
  // Query: Obtener todos los productos con precio base
  const { data: productsWithBasePrice = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products-base-price'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_productos_precio_base')
        .select('*')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching products with base price:', error);
        throw error;
      }
      return (data || []) as ProductBasePrice[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Query: Obtener producto específico con precio base
  const getProductBasePrice = async (productId: string): Promise<ProductBasePrice | null> => {
    const { data, error } = await supabase
      .from('v_productos_precio_base')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) {
      console.error(`Error fetching product ${productId}:`, error);
      return null;
    }
    return data as ProductBasePrice;
  };

  // Obtener productos por categoría (con precio base)
  const getProductsByCategory = async (categoryId: string): Promise<ProductBasePrice[]> => {
    const { data, error } = await supabase
      .from('v_productos_precio_base')
      .select('*')
      .eq('categoria_id', categoryId)
      .eq('is_active', true);

    if (error) {
      console.error(`Error fetching products for category ${categoryId}:`, error);
      return [];
    }
    return (data || []) as ProductBasePrice[];
  };

  // Calcular desglose de precios (para UI)
  const getPriceBreakdown = (product: ProductBasePrice): PriceBreakdown => {
    const porcentaje_margen = product.costo_fabrica > 0 
      ? (product.margin_value / product.costo_fabrica) * 100 
      : 0;

    return {
      costo_fabrica: product.costo_fabrica,
      margen_aplicado: product.margin_value,
      fee_plataforma: product.platform_fee,
      precio_base: product.precio_base,
      porcentaje_margen,
    };
  };

  // Validar si el precio es válido
  const isValidPrice = (price: number): boolean => {
    return typeof price === 'number' && price > 0 && isFinite(price);
  };

  // Formatear precio para UI
  const formatPrice = (price: number, currency: string = 'USD'): string => {
    if (!isValidPrice(price)) return 'N/A';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Comparar precios entre productos
  const comparePrices = (productA: ProductBasePrice, productB: ProductBasePrice): number => {
    return productA.precio_base - productB.precio_base;
  };

  return {
    // Data
    productsWithBasePrice,
    loadingProducts,

    // Methods
    getProductBasePrice,
    getProductsByCategory,
    getPriceBreakdown,
    isValidPrice,
    formatPrice,
    comparePrices,
  };
}
