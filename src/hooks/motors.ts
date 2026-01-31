import { useB2BPricingEngine } from './useB2BPricingEngine';
import { useLogisticsEngine } from './useLogisticsEngineSeparated';
import { useCheckoutCalculator } from './useCheckoutCalculator';

/**
 * INDEX: Motores Separados - Punto de entrada único
 * 
 * Exporta los 3 hooks principales para fácil acceso:
 * 1. useB2BPricingEngine - Motor de precios
 * 2. useLogisticsEngine - Motor de logística
 * 3. useCheckoutCalculator - Orquestador
 * 
 * Uso:
 * import { useB2BPricingEngine, useLogisticsEngine, useCheckoutCalculator } from '@/hooks/motors';
 */

export {
  // Pricing Engine
  useB2BPricingEngine,
  type ProductBasePrice,
  type PriceBreakdown,
} from './useB2BPricingEngine';

export {
  // Logistics Engine
  useLogisticsEngine,
  type ShippingRoute,
  type LogisticsCostResult,
  type LogisticsBreakdown,
} from './useLogisticsEngineSeparated';

export {
  // Checkout Calculator
  useCheckoutCalculator,
  type CheckoutLineItem,
  type CheckoutSummary,
  type ProductCheckoutData,
} from './useCheckoutCalculator';

/**
 * Atajos comunes
 */
export const motors = {
  pricing: useB2BPricingEngine,
  logistics: useLogisticsEngine,
  checkout: useCheckoutCalculator,
};
