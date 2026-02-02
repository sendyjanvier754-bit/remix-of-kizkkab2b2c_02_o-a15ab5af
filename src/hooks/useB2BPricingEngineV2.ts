import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  MultitramoPrice,
  ShippingOption,
  ShippingOptionsResponse,
  ProductShippingValidation,
  GRAMS_TO_KG,
  GRAMS_TO_LB,
  roundUpWeight,
} from '@/types/b2b-shipping';

/**
 * useB2BPricingEngineV2
 * 
 * Motor de precios B2B con soporte multitramo:
 * - Conversión g→kg (Tramo A: China→USA)
 * - Conversión g→lb (Tramo B: USA→Haití)
 * - Redondeo agrupado Math.ceil()
 * - Soporte Standard/Express
 * - Detección de zona por dirección
 */
export function useB2BPricingEngineV2() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calcula precio multitramo completo
   */
  const calculateMultitramoPrice = useCallback(async (
    productId: string,
    addressId: string,
    tierType: 'standard' | 'express' = 'standard',
    quantity: number = 1
  ): Promise<MultitramoPrice | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'calculate_b2b_price_multitramo',
        {
          p_product_id: productId,
          p_address_id: addressId,
          p_tier_type: tierType,
          p_quantity: quantity,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        return null;
      }

      if (!data?.valid) {
        setError(data?.error || 'Error calculando precio');
        return null;
      }

      return data as MultitramoPrice;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Obtiene opciones de envío para una dirección
   */
  const getShippingOptions = useCallback(async (
    addressId: string
  ): Promise<ShippingOptionsResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_shipping_options_for_address',
        { p_address_id: addressId }
      );

      if (rpcError) {
        setError(rpcError.message);
        return null;
      }

      if (!data?.valid) {
        setError(data?.error || 'Sin cobertura');
        return data as ShippingOptionsResponse;
      }

      return data as ShippingOptionsResponse;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Valida si un producto puede usar un tier específico
   */
  const validateProductForShipping = useCallback(async (
    productId: string,
    tierType: 'standard' | 'express' = 'standard'
  ): Promise<ProductShippingValidation | null> => {
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'validate_product_for_shipping',
        {
          p_product_id: productId,
          p_tier_type: tierType,
        }
      );

      if (rpcError) {
        return {
          valid: false,
          errors: [rpcError.message],
          warnings: [],
          is_oversize: false,
          is_sensitive: false,
          allows_express: true,
        };
      }

      return data as ProductShippingValidation;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      return {
        valid: false,
        errors: [errorMsg],
        warnings: [],
        is_oversize: false,
        is_sensitive: false,
        allows_express: true,
      };
    }
  }, []);

  /**
   * Calcula precio sin logística (solo costo base + fees)
   */
  const calculatePriceWithoutShipping = useCallback(async (
    productId: string,
    addressId: string,
    quantity: number = 1
  ): Promise<{
    precio_b2b: number;
    costo_base: number;
    recargos: number;
    platform_fee: number;
    logistica_excluida: number;
  } | null> => {
    const fullPrice = await calculateMultitramoPrice(productId, addressId, 'standard', quantity);
    
    if (!fullPrice || !fullPrice.valid) return null;

    const { desglose, precio_aterrizado } = fullPrice;
    const logistica = desglose.tramo_a_china_usa_kg + desglose.tramo_b_usa_destino_lb;
    const precio_sin_logistica = precio_aterrizado - logistica;

    return {
      precio_b2b: Math.round(precio_sin_logistica * 100) / 100,
      costo_base: desglose.costo_fabrica,
      recargos: desglose.recargo_zona + desglose.recargo_oversize + desglose.recargo_sensible,
      platform_fee: desglose.platform_fee_12pct,
      logistica_excluida: Math.round(logistica * 100) / 100,
    };
  }, [calculateMultitramoPrice]);

  /**
   * Calcula totales para múltiples productos (carrito)
   */
  const calculateCartTotals = useCallback(async (
    items: Array<{ product_id: string; quantity: number }>,
    addressId: string,
    tierType: 'standard' | 'express' = 'standard'
  ): Promise<{
    items_with_prices: Array<{ product_id: string; quantity: number; price: MultitramoPrice | null }>;
    totals: {
      subtotal_products: number;
      subtotal_shipping: number;
      recargos_total: number;
      platform_fees: number;
      total_amount: number;
      total_weight_g: number;
      billable_weight_kg: number;
      billable_weight_lb: number;
      eta_min: number;
      eta_max: number;
      has_oversize: boolean;
      has_sensitive: boolean;
    };
    errors: string[];
  }> => {
    const items_with_prices = await Promise.all(
      items.map(async (item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: await calculateMultitramoPrice(item.product_id, addressId, tierType, item.quantity),
      }))
    );

    const validPrices = items_with_prices.filter(i => i.price?.valid).map(i => i.price!);
    const errors = items_with_prices
      .filter(i => !i.price?.valid)
      .map(i => i.price?.error || `Error en producto ${i.product_id}`);

    // Calcular totales
    let subtotal_products = 0;
    let subtotal_shipping = 0;
    let recargos_total = 0;
    let platform_fees = 0;
    let total_weight_g = 0;
    let eta_min = Infinity;
    let eta_max = 0;
    let has_oversize = false;
    let has_sensitive = false;

    for (const price of validPrices) {
      subtotal_products += price.desglose.costo_fabrica;
      subtotal_shipping += price.desglose.tramo_a_china_usa_kg + price.desglose.tramo_b_usa_destino_lb;
      recargos_total += price.desglose.recargo_zona + price.desglose.recargo_oversize + price.desglose.recargo_sensible;
      platform_fees += price.desglose.platform_fee_12pct;
      total_weight_g += price.peso_total_gramos;
      eta_min = Math.min(eta_min, price.eta_dias_min);
      eta_max = Math.max(eta_max, price.eta_dias_max);
      if (price.is_oversize) has_oversize = true;
      if (price.is_sensitive) has_sensitive = true;
    }

    // Redondeo agrupado del peso total
    const billable_weight_kg = Math.max(1, Math.ceil(total_weight_g / 1000));
    const billable_weight_lb = Math.max(1, Math.ceil(total_weight_g / 453.59237));

    return {
      items_with_prices,
      totals: {
        subtotal_products: Math.round(subtotal_products * 100) / 100,
        subtotal_shipping: Math.round(subtotal_shipping * 100) / 100,
        recargos_total: Math.round(recargos_total * 100) / 100,
        platform_fees: Math.round(platform_fees * 100) / 100,
        total_amount: Math.round((subtotal_products + subtotal_shipping + recargos_total + platform_fees) * 100) / 100,
        total_weight_g,
        billable_weight_kg,
        billable_weight_lb,
        eta_min: eta_min === Infinity ? 0 : eta_min,
        eta_max,
        has_oversize,
        has_sensitive,
      },
      errors,
    };
  }, [calculateMultitramoPrice]);

  /**
   * Formatea precio para UI
   */
  const formatPrice = useCallback((price: number, currency: string = 'USD'): string => {
    if (typeof price !== 'number' || !isFinite(price)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }, []);

  /**
   * Formatea peso para UI
   */
  const formatWeight = useCallback((grams: number): string => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(2)} kg`;
    }
    return `${grams.toFixed(0)} g`;
  }, []);

  /**
   * Formatea ETA para UI
   */
  const formatETA = useCallback((min: number, max: number): string => {
    if (min === max) return `${min} días`;
    return `${min}-${max} días`;
  }, []);

  return {
    // State
    loading,
    error,
    
    // Core Methods
    calculateMultitramoPrice,
    getShippingOptions,
    validateProductForShipping,
    calculatePriceWithoutShipping,
    calculateCartTotals,
    
    // Formatters
    formatPrice,
    formatWeight,
    formatETA,
  };
}

export default useB2BPricingEngineV2;
