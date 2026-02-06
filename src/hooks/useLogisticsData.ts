import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Interfaz para los datos logísticos de un item (producto o variante)
 */
export interface LogisticsDataItem {
  product_id: string;
  variant_id: string | null;
  item_type: 'PRODUCT' | 'VARIANT';
  item_name: string;
  sku: string;
  weight_kg: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  is_oversize: boolean;
  is_active: boolean;
}

/**
 * Interfaz para el resultado del cálculo de costo de envío
 */
export interface ShippingCostResult {
  success: boolean;
  weight_g?: number;
  weight_kg?: number;
  weight_lb?: number;
  is_oversize?: boolean;
  volumetric_weight_kg?: number | null;
  chargeable_weight_kg?: number;
  cost_tramo_a?: number;
  cost_tramo_b?: number;
  surcharge_final_delivery?: number;
  extra_charges_sensitive?: number;
  total_shipping_cost?: number;
  transparency_label?: string;
  error?: string;
}

/**
 * Hook: Obtener datos logísticos de un item individual
 * @param productId - ID del producto
 * @param variantId - ID de la variante (opcional, si es producto base no incluir)
 */
export function useLogisticsData(productId?: string, variantId?: string) {
  const [data, setData] = useState<LogisticsDataItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setData(null);
      return;
    }

    const fetchLogisticsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('v_logistics_data')
          .select('*');

        if (variantId) {
          query = query.eq('variant_id', variantId);
        } else {
          query = query
            .eq('product_id', productId)
            .is('variant_id', null);
        }

        const { data: result, error: err } = await query.single();

        if (err) throw err;
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogisticsData();
  }, [productId, variantId]);

  return { data, isLoading, error };
}

/**
 * Hook: Obtener datos logísticos para múltiples items (lote)
 * @param items - Array de {productId, variantId?}
 */
export function useLogisticsDataBatch(items: Array<{ productId: string; variantId?: string }>) {
  const [dataMap, setDataMap] = useState<Map<string, LogisticsDataItem>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!items || items.length === 0) {
      setDataMap(new Map());
      return;
    }

    const fetchBatchLogisticsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const productIds = items.filter(i => !i.variantId).map(i => i.productId);
        const variantIds = items.filter(i => i.variantId).map(i => i.variantId!);

        console.log('[useLogisticsDataBatch] Fetching:', { productIds, variantIds });

        const map = new Map<string, LogisticsDataItem>();

        // Query 1: Fetch products (sin variante)
        if (productIds.length > 0) {
          console.log('[useLogisticsDataBatch] Product query - productIds:', productIds);
          const { data: productData, error: productErr } = await supabase
            .from('v_logistics_data')
            .select('*')
            .in('product_id', productIds)
            .is('variant_id', null);

          if (productErr) throw productErr;

          console.log('[useLogisticsDataBatch] Product query returned:', productData?.length || 0, 'items');
          productData?.forEach((item: LogisticsDataItem) => {
            const key = `product-${item.product_id}`;
            console.log(`[useLogisticsDataBatch] Adding product key: ${key}, weight_kg: ${item.weight_kg}`);
            map.set(key, item);
          });
        }

        // Query 2: Fetch variants
        if (variantIds.length > 0) {
          console.log('[useLogisticsDataBatch] Variant query - variantIds:', variantIds);
          const { data: variantData, error: variantErr } = await supabase
            .from('v_logistics_data')
            .select('*')
            .in('variant_id', variantIds);

          if (variantErr) throw variantErr;

          console.log('[useLogisticsDataBatch] Variant query returned:', variantData?.length || 0, 'items');
          variantData?.forEach((item: LogisticsDataItem) => {
            const key = `variant-${item.variant_id}`;
            console.log(`[useLogisticsDataBatch] Adding variant key: ${key}, weight_kg: ${item.weight_kg}, product_id: ${item.product_id}`);
            map.set(key, item);
          });
        }

        console.log(`[useLogisticsDataBatch] Complete! Map size: ${map.size}`);
        setDataMap(map);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        console.error('[useLogisticsDataBatch] Error:', errorMessage);
        setError(errorMessage);
        setDataMap(new Map());
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchLogisticsData();
  }, [items]);

  return { dataMap, isLoading, error };
}

/**
 * Hook: Calcular costo de envío para un item
 * @param itemId - ID del producto o variante
 * @param isVariant - Si es variante o no
 * @param quantity - Cantidad de unidades
 * @param routeId - ID de la ruta de envío
 * @param shippingType - Tipo de envío ('STANDARD' o 'EXPRESS')
 * @param destinationZoneId - ID de la zona de destino (opcional)
 */
export function useShippingCostCalculation(
  itemId?: string,
  isVariant: boolean = false,
  quantity: number = 1,
  routeId?: string,
  shippingType: 'STANDARD' | 'EXPRESS' = 'STANDARD',
  destinationZoneId?: string
) {
  const [result, setResult] = useState<ShippingCostResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId || !routeId) {
      setResult(null);
      return;
    }

    const calculateShippingCost = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc(
          'fn_calculate_shipping_cost',
          {
            p_item_id: itemId,
            p_is_variant: isVariant,
            p_quantity: quantity,
            p_route_id: routeId,
            p_shipping_type: shippingType,
            p_destination_zone_id: destinationZoneId || null,
          }
        );

        if (err) throw err;
        setResult(data as ShippingCostResult);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    calculateShippingCost();
  }, [itemId, isVariant, quantity, routeId, shippingType, destinationZoneId]);

  return { result, isLoading, error };
}

/**
 * Hook: Calcular costo de envío para TODO EL CARRITO (suma de todos los items)
 * 
 * IMPORTANTE - Requisito B2B:
 * - NO redondea pesos individuales
 * - Suma TODOS en gramos sin redondeo
 * - Aplica Math.ceil() solo al total final
 * 
 * @param cartItems - Array de items: {productId, variantId?, quantity}
 * @param routeId - ID de la ruta de envío
 * @param shippingType - Tipo de envío ('STANDARD' o 'EXPRESS')
 * @param destinationZoneId - ID de la zona de destino
 */
export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export function useShippingCostCalculationForCart(
  cartItems?: CartItem[],
  routeId?: string,
  shippingType: 'STANDARD' | 'EXPRESS' = 'STANDARD',
  destinationZoneId?: string
) {
  const [result, setResult] = useState<ShippingCostResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightBreakdown, setWeightBreakdown] = useState<Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    weight_kg: number;
    subtotal_weight_g: number;
  }> | null>(null);
  const [itemCosts, setItemCosts] = useState<Array<{
    productId: string;
    variantId?: string;
    weight_kg: number;
    shippingCost: number;
  }> | null>(null);

  // Construir array para useLogisticsDataBatch
  const itemsForBatch = useMemo(() => 
    cartItems?.map(item => ({
      productId: item.productId,
      variantId: item.variantId
    })) || [],
    [cartItems]
  );

  // Obtener datos logísticos de todos los items
  const { dataMap, isLoading: batchLoading, error: batchError } = useLogisticsDataBatch(itemsForBatch);

  useEffect(() => {
    if (!cartItems || cartItems.length === 0 || !routeId || batchLoading || dataMap.size === 0) {
      setResult(null);
      setItemCosts(null);
      return;
    }

    const calculatePerItemShippingCost = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const MINIMUM_WEIGHT_KG = 0.300; // 300g minimum
        const itemCostsArray: typeof itemCosts = [];
        const breakdown: typeof weightBreakdown = [];

        // Paso 1: Recopilar pesos individuales SIN redondear
        let totalWeightKg = 0;
        const itemWeights: Array<{ cartItem: CartItem; weight_kg: number; weightG: number }> = [];

        for (const cartItem of cartItems) {
          const key = cartItem.variantId
            ? `variant-${cartItem.variantId}`
            : `product-${cartItem.productId}`;

          const logisticsData = dataMap.get(key);

          if (!logisticsData) {
            throw new Error(`Producto/variante ${key} no tiene datos logísticos`);
          }

          // Aplicar peso mínimo de 300g si el producto no tiene peso
          const weight_kg = logisticsData.weight_kg > 0 
            ? logisticsData.weight_kg 
            : MINIMUM_WEIGHT_KG;

          const itemWeightG = weight_kg * 1000 * cartItem.quantity;
          totalWeightKg += weight_kg * cartItem.quantity; // Sumar peso total

          breakdown.push({
            productId: cartItem.productId,
            variantId: cartItem.variantId,
            quantity: cartItem.quantity,
            weight_kg: weight_kg,
            subtotal_weight_g: itemWeightG
          });

          itemWeights.push({ cartItem, weight_kg, weightG: itemWeightG });
        }

        console.log('[useShippingCostCalculationForCart] Peso total SIN redondear:', totalWeightKg, 'kg');

        // Paso 2: Hacer UN SOLO RPC call con el peso total
        const { data: totalResult, error: totalError } = await supabase.rpc(
          'fn_calculate_shipping_cost',
          {
            p_item_id: cartItems[0].variantId || cartItems[0].productId, // ID de referencia (no importa mucho)
            p_is_variant: !!cartItems[0].variantId,
            p_quantity: 1, // Ya incluimos cantidades en totalWeightKg
            p_weight_kg: totalWeightKg, // PESO TOTAL: se redondea aquí en la BD
            p_route_id: routeId,
            p_shipping_type: shippingType,
            p_destination_zone_id: destinationZoneId || null,
          }
        );

        if (totalError) throw totalError;

        const totalShippingCost = totalResult?.total_shipping_cost || 0;

        console.log('[useShippingCostCalculationForCart] Costo total:', totalShippingCost, 'por peso total:', totalWeightKg);

        // Paso 3: Distribuir el costo total entre items (proporcional al peso)
        for (const { cartItem, weight_kg } of itemWeights) {
          const itemProportionalCost = (weight_kg * cartItem.quantity / totalWeightKg) * totalShippingCost;

          itemCostsArray.push({
            productId: cartItem.productId,
            variantId: cartItem.variantId,
            weight_kg: weight_kg, // Mostrar peso individual SIN redondear
            shippingCost: itemProportionalCost
          });
        }

        setWeightBreakdown(breakdown);
        setItemCosts(itemCostsArray);

        console.log('[useShippingCostCalculationForCart] itemCostsArray:', itemCostsArray);
        console.log('[useShippingCostCalculationForCart] Suma manual de costos:', itemCostsArray.reduce((sum, item) => sum + item.shippingCost, 0));

        // Retornar resultado consolidado
        setResult({
          success: true,
          total_shipping_cost: totalShippingCost
        } as ShippingCostResult);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        console.error('[calculatePerItemShippingCost] Error:', errorMessage);
        setError(errorMessage);
        setResult(null);
        setItemCosts(null);
      } finally {
        setIsLoading(false);
      }
    };

    calculatePerItemShippingCost();
  }, [cartItems, routeId, shippingType, destinationZoneId, dataMap.size, batchLoading]);

  return { 
    result, 
    isLoading: isLoading || batchLoading, 
    error: error || batchError,
    weightBreakdown,
    itemCosts // NEW: costos individuales por item
  };
}

/**
 * Hook: Obtener todas las rutas de envío disponibles
 */
export function useShippingRoutes() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoutes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('shipping_routes')
          .select('*')
          .eq('is_active', true);

        if (err) throw err;
        setRoutes(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        setRoutes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoutes();
  }, []);

  return { routes, isLoading, error };
}

/**
 * Hook: Obtener todas las zonas de envío disponibles
 */
export function useShippingZones() {
  const [zones, setZones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchZones = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('shipping_zones')
          .select('*')
          .eq('is_active', true)
          .order('country', { ascending: true })
          .order('zone_name', { ascending: true });

        if (err) throw err;
        setZones(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        setZones([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchZones();
  }, []);

  return { zones, isLoading, error };
}
