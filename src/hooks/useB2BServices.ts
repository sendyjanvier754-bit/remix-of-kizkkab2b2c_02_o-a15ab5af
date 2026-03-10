// ============================================================================
// B2B SERVICES - React Hooks para Motor de Precios + Checkout + PO
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UUID } from 'crypto';

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

export interface Product {
  id: UUID;
  name: string;
  sku: string;
  costo_base_excel: number;
  weight_g: number;
  is_oversize: boolean;
  is_sensitive: boolean;
  product_class: 'standard' | 'oversize' | 'sensitive' | 'oversize_sensitive';
}

export interface Address {
  id: UUID;
  street: string;
  commune_id: UUID;
  country_id: UUID;
  zone_surcharge: number;
  zone_level: number;
}

export interface PriceBreakdown {
  valid: boolean;
  producto_id: UUID;
  cantidad: number;
  peso_total_gramos: number;
  peso_facturable_kg: number;
  peso_facturable_lb: number;
  desglose: {
    costo_fabrica: number;
    tramo_a_china_usa_kg: number;
    tramo_b_usa_destino_lb: number;
    recargo_sensible: number;
    recargo_oversize: number;
    recargo_zona: number;
    platform_fee_12pct: number;
  };
  precio_aterrizado: number;
  precio_unitario: number;
  shipping_type: 'standard' | 'express';
  eta_dias_min: number;
  eta_dias_max: number;
  zone_level: number;
  error?: string;
}

export interface ShippingOption {
  destination_country_id: UUID;
  route_id: UUID;
  country_name: string;
  tier_type: 'standard' | 'express';
  tramo_a_cost_per_kg: number;
  tramo_b_cost_per_lb: number;
  eta_min_total: number;
  eta_max_total: number;
}

export interface CartItem {
  product_id: UUID;
  quantity: number;
  product?: Product;
  priceBreakdown?: PriceBreakdown;
}

export interface POCheckoutSummary {
  items: CartItem[];
  addressId: UUID;
  shippingType: 'standard' | 'express';
  subtotalProducts: number;
  subtotalShipping: number;
  platformFees: number;
  totalAmount: number;
  estimatedDays: { min: number; max: number };
}

// ============================================================================
// 1. HOOK: useB2BPricing
// ============================================================================

export function useB2BPricing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper: Calcular precio B2B SIN logística
  // = precio_aterrizado - (tramo_a + tramo_b)
  // = costo_base + recargo_sensible + recargo_oversize + recargo_zona + platform_fee
  const calculatePriceB2BNoShipping = useCallback(
    async (
      productId: UUID,
      addressId: UUID,
      quantity: number = 1
    ): Promise<{ 
      precio_b2b: number;
      costo_base: number;
      recargo_sensible: number;
      recargo_oversize: number;
      recargo_zona: number;
      platform_fee: number;
      logistica_restada: number;
    } | null> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'calculate_b2b_price_multitramo',
          {
            p_product_id: productId,
            p_shipping_zone_id: addressId,
            p_quantity: quantity,
          } as any
        );

        if (rpcError) {
          setError(rpcError.message);
          return null;
        }

        const r = data as any;
        if (!r.valid) {
          setError(r.error || 'Error calculating price');
          return null;
        }

        // Extraer componentes del desglose
        const costoBase = r.desglose.costo_fabrica;
        const tramoA = r.desglose.tramo_a_china_usa_kg;
        const tramoB = r.desglose.tramo_b_usa_destino_lb;
        const recargoSensible = r.desglose.recargo_sensible;
        const recargoOversize = r.desglose.recargo_oversize;
        const recargoZona = r.desglose.recargo_zona;
        const platformFee = r.desglose.platform_fee_12pct;

        // LOGÍSTICA = Tramo A + Tramo B (LO QUE SE RESTA)
        const logisticaCosto = tramoA + tramoB;

        // PRECIO SIN LOGÍSTICA = precio_aterrizado - logística
        const precioB2BSinLogistica = (r as any).precio_aterrizado - logisticaCosto;

        return {
          precio_b2b: Math.round(precioB2BSinLogistica * 100) / 100,
          costo_base: Math.round(costoBase * 100) / 100,
          recargo_sensible: Math.round(recargoSensible * 100) / 100,
          recargo_oversize: Math.round(recargoOversize * 100) / 100,
          recargo_zona: Math.round(recargoZona * 100) / 100,
          platform_fee: Math.round(platformFee * 100) / 100,
          logistica_restada: Math.round(logisticaCosto * 100) / 100,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const calculatePrice = useCallback(
    async (
      productId: UUID,
      addressId: UUID,
      tier: 'standard' | 'express' = 'standard',
      quantity: number = 1
    ): Promise<PriceBreakdown | null> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'calculate_b2b_price_multitramo',
          {
            p_product_id: productId,
            p_shipping_zone_id: addressId,
            p_quantity: quantity,
          } as any
        );

        if (rpcError) {
          setError(rpcError.message);
          return null;
        }

        const d2 = data as any;
        if (!d2.valid) {
          setError(d2.error || 'Error calculating price');
          return null;
        }

        return d2 as unknown as PriceBreakdown;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const validateProductForShipping = useCallback(
    async (
      productId: UUID,
      tier: 'standard' | 'express'
    ): Promise<{ valid: boolean; errors: string[] }> => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'validate_product_for_shipping',
          {
            p_product_id: productId,
            p_tier_type: tier,
          }
        );

        if (rpcError) {
          return { valid: false, errors: [rpcError.message] };
        }

        return data as unknown as { valid: boolean; errors: string[] };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        return { valid: false, errors: [errorMsg] };
      }
    },
    []
  );

  return {
    calculatePrice,
    calculatePriceB2BNoShipping,
    validateProductForShipping,
    loading,
    error,
  };
}

// ============================================================================
// 2. HOOK: useB2BCheckout
// ============================================================================

export function useB2BCheckout() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedTier, setSelectedTier] = useState<'standard' | 'express'>('standard');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { calculatePrice, validateProductForShipping } = useB2BPricing();

  // Agregar producto al carrito
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product_id: product.id, quantity, product }];
    });
  }, []);

  // Actualizar cantidad
  const updateQuantity = useCallback((productId: UUID, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((item) => item.product_id !== productId)
        : prev.map((item) =>
            item.product_id === productId ? { ...item, quantity } : item
          )
    );
  }, []);

  // Cargar opciones de envío por dirección
  const loadShippingOptions = useCallback(async (address: Address) => {
    setLoading(true);
    setError(null);
    try {
      // Query: v_shipping_options_by_country
      const { data, error: queryError } = await (supabase as any)
        .from('v_shipping_options_by_country')
        .select('*')
        .eq('destination_country_id', address.country_id);

      if (queryError) {
        setError(queryError.message);
        return;
      }

      setShippingOptions(data as ShippingOption[]);
      setSelectedAddress(address);
      setSelectedTier('standard'); // Reset tier
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recalcular precios para todos items en el carrito
  const recalcuateCartPrices = useCallback(async () => {
    if (!selectedAddress) {
      setError('No address selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedCart = await Promise.all(
        cart.map(async (item) => {
          const priceBreakdown = await calculatePrice(
            item.product_id,
            selectedAddress.id,
            selectedTier,
            item.quantity
          );
          return { ...item, priceBreakdown };
        })
      );

      setCart(updatedCart);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [cart, selectedAddress, selectedTier, calculatePrice]);

  // Calcular totales
  const calculateTotals = useCallback((): POCheckoutSummary => {
    const subtotalProducts = cart.reduce((sum, item) => {
      if (item.priceBreakdown?.desglose?.costo_fabrica) {
        return sum + item.priceBreakdown.desglose.costo_fabrica * item.quantity;
      }
      return sum;
    }, 0);

    const subtotalShipping = cart.reduce((sum, item) => {
      if (item.priceBreakdown) {
        const {
          tramo_a_china_usa_kg,
          tramo_b_usa_destino_lb,
          recargo_sensible,
          recargo_oversize,
          recargo_zona,
        } = item.priceBreakdown.desglose;
        return (
          sum +
          (tramo_a_china_usa_kg +
            tramo_b_usa_destino_lb +
            recargo_sensible +
            recargo_oversize +
            recargo_zona)
        );
      }
      return sum;
    }, 0);

    const platformFees = cart.reduce((sum, item) => {
      if (item.priceBreakdown?.desglose?.platform_fee_12pct) {
        return sum + item.priceBreakdown.desglose.platform_fee_12pct * item.quantity;
      }
      return sum;
    }, 0);

    const totalAmount = subtotalProducts + subtotalShipping + platformFees;

    // Calcular ETA range
    const etaValues = cart
      .map((item) => item.priceBreakdown)
      .filter((pb) => pb !== undefined);
    const minEta = Math.min(...etaValues.map((pb) => pb.eta_dias_min));
    const maxEta = Math.max(...etaValues.map((pb) => pb.eta_dias_max));

    return {
      items: cart,
      addressId: (selectedAddress?.id ?? '00000000-0000-0000-0000-000000000000') as `${string}-${string}-${string}-${string}-${string}`,
      shippingType: selectedTier,
      subtotalProducts: Math.round(subtotalProducts * 100) / 100,
      subtotalShipping: Math.round(subtotalShipping * 100) / 100,
      platformFees: Math.round(platformFees * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      estimatedDays: { min: minEta, max: maxEta },
    };
  }, [cart, selectedTier, selectedAddress]);

  return {
    // State
    cart,
    selectedAddress,
    selectedTier,
    shippingOptions,
    loading,
    error,
    // Methods
    addToCart,
    updateQuantity,
    loadShippingOptions,
    setSelectedTier,
    recalcuateCartPrices,
    calculateTotals,
    validateProductForShipping,
  };
}

// ============================================================================
// 3. HOOK: usePOMaster
// ============================================================================

export function usePOMaster() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPO = useCallback(
    async (
      investorId: UUID,
      countryId: UUID,
      communeId: UUID,
      items: CartItem[],
      checkoutSummary: POCheckoutSummary
    ) => {
      setLoading(true);
      setError(null);

      try {
        // 1. Crear PO Maestra
        const { data: poData, error: poError } = await supabase
          .from('master_purchase_orders')
          .insert({
            investor_id: investorId,
            country_id: countryId,
            commune_id: communeId,
            status: 'open',
            total_items: items.length,
            total_amount: checkoutSummary.totalAmount,
            has_express: checkoutSummary.shippingType === 'express',
          })
          .select()
          .single();

        if (poError) {
          setError(poError.message);
          return null;
        }

        const poId = poData.id;

        // 2. Insertar items en PO
        const poItems = items.map((item) => ({
          po_id: poId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.priceBreakdown?.precio_unitario || 0,
          total_price: item.priceBreakdown?.precio_aterrizado
            ? item.priceBreakdown.precio_aterrizado * item.quantity
            : 0,
          weight_g: item.priceBreakdown?.peso_total_gramos || 0,
          shipping_cost: item.priceBreakdown
            ? item.priceBreakdown.desglose.tramo_a_china_usa_kg +
              item.priceBreakdown.desglose.tramo_b_usa_destino_lb
            : 0,
          is_sensitive: item.product?.is_sensitive || false,
          is_oversize: item.product?.is_oversize || false,
        }));

        const { error: itemsError } = await supabase
          .from('po_items')
          .insert(poItems);

        if (itemsError) {
          setError(itemsError.message);
          // Rollback: Eliminar PO creada
          await supabase.from('master_purchase_orders').delete().eq('id', poId);
          return null;
        }

        return poData;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getInvestorPOs = useCallback(async (investorId: UUID) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('v_open_pos_by_investor')
        .select('*')
        .eq('investor_id', investorId);

      if (queryError) {
        setError(queryError.message);
        return [];
      }

      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const closePOAndOpenNew = useCallback(async (poId: UUID) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'close_po_and_open_new',
        { p_po_id: poId }
      );

      if (rpcError) {
        setError(rpcError.message);
        return null;
      }

      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createPO,
    getInvestorPOs,
    closePOAndOpenNew,
  };
}

// ============================================================================
// 4. HOOK: useB2BProducts (Listar productos visibles en B2B)
// ============================================================================

export function useB2BProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('v_products_b2b')
        .select('*');

      if (queryError) {
        setError(queryError.message);
        return;
      }

      setProducts(data as Product[]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return { products, loading, error, refetch: loadProducts };
}

// ============================================================================
// EXPORT ÍNDICE
// ============================================================================

export default {
  useB2BPricing,
  useB2BCheckout,
  usePOMaster,
  useB2BProducts,
};
