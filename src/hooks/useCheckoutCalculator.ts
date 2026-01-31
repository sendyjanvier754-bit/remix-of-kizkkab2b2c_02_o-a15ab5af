import { useMemo, useState, useCallback } from 'react';
import { useB2BPricingEngine, ProductBasePrice, PriceBreakdown } from './useB2BPricingEngine';
import { useLogisticsEngine, LogisticsCostResult, LogisticsBreakdown } from './useLogisticsEngineSeparated';

/**
 * CHECKOUT CALCULATOR: Orquestador de Precio + Logística
 * 
 * Unifica ambos motores en el checkout:
 * - Motor de Precio: precio_base
 * - Motor de Logística: logistics_cost
 * - TOTAL = precio_base + logistics_cost + impuestos
 * 
 * Uso:
 * const { calculateCheckoutTotal, getCheckoutSummary } = useCheckoutCalculator();
 * const summary = await calculateCheckoutTotal(product, routeId, quantity);
 */

export interface CheckoutLineItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  priceBase: number;
  logisticsCost: number;
  subtotal: number; // priceBase * quantity + logisticsCost
}

export interface CheckoutSummary {
  items: CheckoutLineItem[];
  subtotalPrice: number; // Sum of base prices * quantity
  logisticsCost: number; // Sum of all logistics
  subtotal: number; // subtotalPrice + logisticsCost
  platformFee: number; // 12% of subtotal
  tax: number; // VAT/Sales tax (if applicable)
  total: number; // subtotal + platformFee + tax
  routeId: string | null;
  routeName: string | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}

export interface ProductCheckoutData {
  product: ProductBasePrice;
  quantity: number;
  routeId: string;
}

export function useCheckoutCalculator() {
  const pricingEngine = useB2BPricingEngine();
  const logisticsEngine = useLogisticsEngine();

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<ProductCheckoutData[]>([]);

  /**
   * Calcular total de un producto en checkout
   * TOTAL = (precio_base * cantidad) + costo_logística
   */
  const calculateItemTotal = async (
    product: ProductBasePrice,
    quantity: number,
    routeId: string
  ): Promise<CheckoutLineItem | null> => {
    try {
      // Validar inputs
      if (quantity <= 0 || !product.precio_base) {
        console.warn('Invalid quantity or price');
        return null;
      }

      // Calcular costo de logística
      const logisticsCost = await logisticsEngine.calculateLogisticsCost(
        routeId,
        product.weight_kg * quantity
      );

      if (!logisticsCost) {
        console.error(`Failed to calculate logistics for route ${routeId}`);
        return null;
      }

      // El subtotal incluye el precio base (sin logística por cantidad)
      // porque la logística es por envío, no por producto
      const subtotal = product.precio_base * quantity + logisticsCost.total_cost;

      return {
        productId: product.product_id,
        sku: product.sku_interno,
        productName: product.nombre,
        quantity,
        priceBase: product.precio_base,
        logisticsCost: logisticsCost.total_cost,
        subtotal,
      };
    } catch (error) {
      console.error('Error calculating item total:', error);
      return null;
    }
  };

  /**
   * Calcular resumen completo de checkout
   */
  const calculateCheckoutTotal = async (
    items: ProductCheckoutData[],
    countryCode?: string,
    currencyCode: string = 'USD'
  ): Promise<CheckoutSummary | null> => {
    try {
      if (!items.length || !selectedRoute) {
        console.warn('No items or route selected');
        return null;
      }

      // Calcular líneas
      const checkoutLines: CheckoutLineItem[] = [];
      let totalPriceComponent = 0;
      let totalLogisticsComponent = 0;

      for (const item of items) {
        const lineItem = await calculateItemTotal(
          item.product,
          item.quantity,
          item.routeId
        );

        if (lineItem) {
          checkoutLines.push(lineItem);
          totalPriceComponent += lineItem.priceBase * lineItem.quantity;
          totalLogisticsComponent += lineItem.logisticsCost;
        }
      }

      if (!checkoutLines.length) {
        return null;
      }

      // Subtotal (precios + logística)
      const subtotal = totalPriceComponent + totalLogisticsComponent;

      // Platform fee (12%)
      const platformFee = subtotal * 0.12;

      // Tax (simplificado, depende del país)
      // TODO: Integrar con sistema de impuestos
      const tax = subtotal * 0.10; // 10% placeholder

      // Total final
      const total = subtotal + platformFee + tax;

      // Información de ruta
      const routeInfo = logisticsEngine.getRouteInfo(selectedRoute);
      const estimatedDays = logisticsEngine.getEstimatedDays(selectedRoute);

      return {
        items: checkoutLines,
        subtotalPrice: totalPriceComponent,
        logisticsCost: totalLogisticsComponent,
        subtotal,
        platformFee,
        tax,
        total,
        routeId: selectedRoute,
        routeName: routeInfo?.destination_country_name || null,
        estimatedDaysMin: estimatedDays?.min || null,
        estimatedDaysMax: estimatedDays?.max || null,
      };
    } catch (error) {
      console.error('Error calculating checkout total:', error);
      return null;
    }
  };

  /**
   * Agregar producto al checkout
   */
  const addToCheckout = (product: ProductBasePrice, quantity: number, routeId: string) => {
    setCheckoutItems(prev => [
      ...prev,
      { product, quantity, routeId }
    ]);
    setSelectedRoute(routeId);
  };

  /**
   * Remover producto del checkout
   */
  const removeFromCheckout = (productId: string) => {
    setCheckoutItems(prev => prev.filter(item => item.product.product_id !== productId));
  };

  /**
   * Actualizar cantidad
   */
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCheckout(productId);
      return;
    }

    setCheckoutItems(prev =>
      prev.map(item =>
        item.product.product_id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  /**
   * Cambiar ruta de envío
   */
  const changeRoute = (routeId: string) => {
    if (logisticsEngine.isValidRoute(routeId)) {
      setSelectedRoute(routeId);
    }
  };

  /**
   * Limpiar carrito
   */
  const clearCheckout = () => {
    setCheckoutItems([]);
    setSelectedRoute(null);
  };

  /**
   * Obtener rutas recomendadas (las más baratas)
   */
  const getRecommendedRoutes = (): string[] => {
    if (!checkoutItems.length) return [];

    const totalWeight = checkoutItems.reduce(
      (sum, item) => sum + (item.product.weight_kg * item.quantity),
      0
    );

    const validRoutes = logisticsEngine.routes
      .map(route => route.route_id)
      .filter(routeId => logisticsEngine.isValidRoute(routeId));

    // Retornar las 3 rutas más baratas
    return validRoutes
      .map(routeId => ({
        routeId,
        cost: logisticsEngine.calculateCostPerKg(routeId, totalWeight),
      }))
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 3)
      .map(item => item.routeId);
  };

  /**
   * Formatear resumen para UI
   */
  const formatCheckoutSummary = (summary: CheckoutSummary): Record<string, any> => {
    return {
      itemsCount: summary.items.length,
      subtotalPrice: `$${summary.subtotalPrice.toFixed(2)}`,
      logisticsCost: `$${summary.logisticsCost.toFixed(2)}`,
      subtotal: `$${summary.subtotal.toFixed(2)}`,
      platformFee: `$${summary.platformFee.toFixed(2)}`,
      tax: `$${summary.tax.toFixed(2)}`,
      total: `$${summary.total.toFixed(2)}`,
      route: summary.routeName,
      estimatedDelivery: summary.estimatedDaysMin && summary.estimatedDaysMax
        ? `${summary.estimatedDaysMin}-${summary.estimatedDaysMax} days`
        : 'N/A',
    };
  };

  // Memoizar items del checkout
  const memoizedItems = useMemo(() => checkoutItems, [checkoutItems]);

  return {
    // State
    checkoutItems: memoizedItems,
    selectedRoute,

    // Methods
    addToCheckout,
    removeFromCheckout,
    updateQuantity,
    changeRoute,
    clearCheckout,
    calculateItemTotal,
    calculateCheckoutTotal,
    getRecommendedRoutes,
    formatCheckoutSummary,

    // Data from engines
    availableRoutes: logisticsEngine.routes,
    loadingRoutes: logisticsEngine.loadingRoutes,
  };
}
