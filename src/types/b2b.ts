/**
 * Tipos para el módulo B2B (Mayorista)
 */

// EAV Attribute Combination - stores all variant attributes in one object
export interface AttributeCombination {
  color?: string;
  size?: string;
  age?: string;
  model?: string;
  voltage?: string;
  watts?: string;
  material?: string;
  [key: string]: string | undefined;
}

// Product Variant from EAV system (product_variants table)
export interface ProductVariantEAV {
  id: string;
  sku: string;
  name: string;
  price: number;
  precio_b2b_final?: number; // ✅ Calculated B2B price from v_variantes_con_precio_b2b
  stock: number;
  moq: number;
  attribute_combination: AttributeCombination;
  product_id: string;
  is_active?: boolean;
  images?: string[]; // Variant-specific images
  image_url?: string; // Primary variant image
}

export interface ProductVariantInfo {
  id: string;
  sku: string;
  label: string;
  precio: number;
  precio_b2b_final?: number; // ✅ Precio B2B calculado desde vista (con márgenes y fees)
  stock: number;
  option_type?: string; // 'color', 'size', 'material', etc.
  parent_product_id?: string; // Which product this variant belongs to
  attribute_combination?: AttributeCombination; // EAV data
  images?: string[]; // Variant-specific images
  image_url?: string; // Primary variant image
}

export interface VariantOption {
  productId: string;
  label: string;
  code?: string;
  image?: string; // Image for this specific option
  price: number;
  stock: number;
  type: string; // 'color' | 'size' | 'age' | 'combo' | 'unknown'
}

// Backwards compatibility alias
export type ColorOption = VariantOption;

export interface VariantsByType {
  [type: string]: VariantOption[];
}

// Variant with image for matrix management
export interface VariantMatrixItem {
  id?: string;
  sku: string;
  attributeValues: Record<string, string>; // { color: 'Rojo', size: 'M' }
  price: number;
  priceAdjustment: number;
  stock: number;
  imageUrl: string;
  imageFile?: File; // For upload
  isNew?: boolean;
}

// Attribute definition for matrix
export interface AttributeDefinition {
  id: string;
  name: string;
  displayName: string;
  type: 'color' | 'size' | 'text' | 'select';
  values: string[];
}

// Logistics info for B2B products
export interface B2BLogisticsInfo {
  routeId: string | null;
  routeName: string;
  logisticsCost: number;
  estimatedDays: { min: number; max: number };
  originCountry: string;
  destinationCountry: string;
}

export interface ProductB2BCard {
  id: string;
  sku: string;
  nombre: string;
  precio_b2b: number;
  precio_b2b_max?: number; // Max price for price range display
  precio_sugerido: number; // PVP sugerido
  moq: number;
  stock_fisico: number;
  imagen_principal: string;
  categoria_id: string;
  rating?: number; // Average rating
  review_count?: number; // Number of reviews
  source_product_id?: string; // Reference to products table for variants
  variant_count?: number; // Number of variants
  variant_ids?: string[]; // IDs of all variants
  variants?: ProductVariantInfo[]; // Size/other variants from product_variants table
  variant_options?: VariantOption[]; // All variants derived from grouped products
  variant_type?: string; // Primary type: 'color' | 'size' | 'age' | 'combo'
  variant_types?: string[]; // All detected types
  variants_by_type?: VariantsByType; // Variants grouped by type
  has_grouped_variants?: boolean; // Whether this product has multiple grouped variants
  // Backwards compatibility
  color_options?: VariantOption[];
  has_color_variants?: boolean;
  // Market reference data (B2C cross-reference)
  pvp_reference?: number; // MAX price from B2C market
  pvp_source?: 'market' | 'admin' | 'calculated'; // Source of PVP
  is_market_synced?: boolean; // True if synced with B2C market
  num_b2c_sellers?: number; // Number of sellers in B2C with this product
  profit_amount?: number; // PVP - Costo B2B
  roi_percent?: number; // ROI percentage
  
  // B2B Price Engine fields
  factory_cost?: number; // Costo de fábrica (base)
  margin_percent?: number; // Porcentaje de margen aplicado
  margin_value?: number; // Valor del margen en USD
  subtotal_with_margin?: number; // Costo + Margen (antes de logística)
  
  // Logistics fields
  logistics?: B2BLogisticsInfo | null;
  logistics_cost?: number; // Costo de envío
  category_fees?: number; // Tarifas de categoría
  estimated_delivery_days?: { min: number; max: number }; // Tiempo estimado de entrega
}

export interface CartItemB2B {
  productId: string;
  sku: string;
  nombre: string;
  precio_b2b: number;
  moq: number;
  stock_fisico: number;
  cantidad: number; // Cantidad solicitada
  subtotal: number; // precio_b2b * cantidad
  imagen_principal?: string; // URL de la imagen del producto
  variantLabel?: string; // Label of the variant (e.g., "S", "M", "4-5Y")
  color?: string; // Color if applicable
  size?: string; // Size if applicable
  // Variant fields from database
  variantId?: string; // Reference to product_variants.id
  variantAttributes?: Record<string, any>; // Full variant attributes
  unit_price?: number; // B2B unit price from cart
}

export interface CartB2B {
  items: CartItemB2B[];
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
}

export interface OrderB2B {
  id?: string;
  seller_id: string;
  items: CartItemB2B[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: 'stripe' | 'moncash' | 'transfer';
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  created_at?: string;
}

export interface B2BFilters {
  searchQuery: string;
  category: string | null;
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'moq_asc' | 'moq_desc';
}
