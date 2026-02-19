// ============================================================================
// B2B SHIPPING TYPES - Motor Multitramo
// ============================================================================

// Constantes de conversión
export const GRAMS_TO_KG = 1000;
export const GRAMS_TO_LB = 453.59237;
export const MIN_BILLABLE_WEIGHT = 1;
export const CBM_FACTOR = 5000;

// Función de redondeo B2B
export const roundUpWeight = (weight: number): number => 
  Math.max(MIN_BILLABLE_WEIGHT, Math.ceil(weight));

// Zona de envío
export interface ShippingZone {
  id: string;
  country_id: string;
  zone_code: string;
  zone_name: string;
  zone_level: 1 | 2 | 3 | 4 | 5; // 1=Capital, 5=Remote
  surcharge_percent: number;
  is_capital: boolean;
  is_remote: boolean;
  coverage_active: boolean;
  min_delivery_days: number;
  max_delivery_days: number;
}

// Tier de envío (Standard/Express)
export interface ShippingTier {
  id: string;
  route_id: string;
  tier_type: 'standard' | 'express';
  tier_name: string;
  tier_description?: string;
  transport_type: 'maritimo' | 'aereo' | 'terrestre';
  custom_tier_name?: string | null;
  tier_origin_country?: string | null;
  tier_destination_country?: string | null;
  // Tramo A: China → USA (USD/kg)
  tramo_a_cost_per_kg: number;
  tramo_a_eta_min: number;
  tramo_a_eta_max: number;
  // Tramo B: USA → Destino (USD/kg y USD/lb)
  tramo_b_cost_per_kg: number;  // Fuente de verdad para cálculos
  tramo_b_cost_per_lb: number;  // Para display en UI
  tramo_b_eta_min: number;
  tramo_b_eta_max: number;
  // Config
  is_active: boolean;
  allows_oversize: boolean;
  allows_sensitive: boolean;
  priority_order: number;
}

// Clasificación de producto para envío
export interface ProductShippingClass {
  id: string;
  product_id: string;
  is_oversize: boolean;
  is_sensitive: boolean;
  sensitivity_type?: 'liquid' | 'battery' | 'fragile' | 'hazardous';
  oversize_surcharge_percent: number;
  sensitive_surcharge_per_gram: number;
  allows_express: boolean;
  requires_special_packing: boolean;
  packing_instructions?: string;
  volume_factor: number;
}

// Desglose de precios multitramo
export interface MultitramoBreakdown {
  costo_fabrica: number;
  costo_fabrica_unitario: number;
  tramo_a_china_usa_kg: number;
  tramo_b_usa_destino_lb: number;
  recargo_zona: number;
  recargo_oversize: number;
  recargo_sensible: number;
  platform_fee_12pct: number;
  zone_level: number;
  zone_name: string;
}

// Resultado del cálculo de precio multitramo
export interface MultitramoPrice {
  valid: boolean;
  error?: string;
  producto_id: string;
  cantidad: number;
  // Pesos
  peso_total_gramos: number;
  peso_kg: number;
  peso_lb: number;
  peso_facturable_kg: number;
  peso_facturable_lb: number;
  // Desglose
  desglose: MultitramoBreakdown;
  // Totales
  precio_aterrizado: number;
  precio_unitario: number;
  // Shipping
  shipping_type: 'standard' | 'express';
  tier_name: string;
  eta_dias_min: number;
  eta_dias_max: number;
  // Flags
  is_oversize: boolean;
  is_sensitive: boolean;
  allows_express: boolean;
}

// Opción de envío para checkout
export interface ShippingOption {
  tier_id: string | null;
  tier_type: 'standard' | 'express';
  tier_name: string;
  route_name?: string;
  tramo_a_cost_per_kg: number;
  tramo_b_cost_per_lb: number;
  eta_min: number;
  eta_max: number;
  allows_oversize: boolean;
  allows_sensitive: boolean;
  zone_surcharge_percent: number;
}

// Respuesta de opciones de envío
export interface ShippingOptionsResponse {
  valid: boolean;
  error?: string;
  zone_id?: string;
  zone_name?: string;
  zone_level?: number;
  surcharge_percent?: number;
  options: ShippingOption[];
}

// Validación de producto para envío
export interface ProductShippingValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  is_oversize: boolean;
  is_sensitive: boolean;
  allows_express: boolean;
}

// ID de tracking híbrido
export interface HybridTrackingId {
  country_code: string; // HT
  department_code: string; // OU
  po_number: string; // PO2401
  china_tracking: string; // CHN12345
  hub_code: string; // MIA
  sequence: string; // 0001
  suffixes: string[]; // ['-EXP', '-OVZ', '-SEN']
  full_id: string; // HT-OU-PO2401-CHN12345-MIA-0001-EXP
}

// Resultado de cierre de PO
export interface POCloseResult {
  success: boolean;
  error?: string;
  closed_po_id?: string;
  closed_po_number?: string;
  orders_transitioned?: number;
  new_po_id?: string;
  new_po_number?: string;
}

// Item de carrito B2B con precio multitramo
export interface B2BCartItemWithPrice {
  product_id: string;
  variant_id?: string;
  quantity: number;
  product_name: string;
  sku: string;
  image?: string;
  weight_g: number;
  priceBreakdown?: MultitramoPrice;
}

// Resumen de checkout B2B
export interface B2BCheckoutSummary {
  items: B2BCartItemWithPrice[];
  address_id: string;
  shipping_type: 'standard' | 'express';
  // Totales
  subtotal_products: number;
  subtotal_shipping: number;
  recargos_total: number;
  platform_fees: number;
  total_amount: number;
  // Pesos
  total_weight_g: number;
  billable_weight_kg: number;
  billable_weight_lb: number;
  // ETA
  eta_min: number;
  eta_max: number;
  // Flags
  has_oversize: boolean;
  has_sensitive: boolean;
}

// Helper: Convertir gramos a unidades
export const convertWeight = (grams: number) => ({
  g: grams,
  kg: grams / GRAMS_TO_KG,
  lb: grams / GRAMS_TO_LB,
  kg_billable: roundUpWeight(grams / GRAMS_TO_KG),
  lb_billable: roundUpWeight(grams / GRAMS_TO_LB),
});

// Helper: Calcular peso volumétrico
export const calculateVolumetricWeight = (
  length_cm: number,
  width_cm: number,
  height_cm: number,
  quantity: number = 1,
  factor: number = CBM_FACTOR
): number => {
  return (length_cm * width_cm * height_cm * quantity) / factor;
};

// Helper: Obtener peso facturable (mayor entre real y volumétrico)
export const getBillableWeight = (
  weight_g: number,
  length_cm: number,
  width_cm: number,
  height_cm: number,
  quantity: number = 1,
  is_oversize: boolean = false
): { kg: number; lb: number } => {
  const weight_kg = (weight_g * quantity) / GRAMS_TO_KG;
  
  if (is_oversize) {
    const volumetric_kg = calculateVolumetricWeight(length_cm, width_cm, height_cm, quantity);
    const billable_kg = Math.max(weight_kg, volumetric_kg);
    return {
      kg: roundUpWeight(billable_kg),
      lb: roundUpWeight(billable_kg * 2.20462),
    };
  }
  
  return {
    kg: roundUpWeight(weight_kg),
    lb: roundUpWeight((weight_g * quantity) / GRAMS_TO_LB),
  };
};

// Instrucciones de packing según clasificación
export const getPackingInstructions = (
  is_oversize: boolean,
  is_sensitive: boolean
): string => {
  if (is_oversize) return 'Embalaje Especial - Dimensiones XL';
  if (is_sensitive) return 'Manejo Especial - Producto Frágil/Líquido/Batería';
  return 'Caja Estándar';
};

// Sufijos de tracking según clasificación
export const getTrackingSuffixes = (
  is_express: boolean,
  is_oversize: boolean,
  is_sensitive: boolean
): string => {
  let suffix = '';
  if (is_express) suffix += '-EXP';
  if (is_oversize) suffix += '-OVZ';
  if (is_sensitive) suffix += '-SEN';
  return suffix;
};
