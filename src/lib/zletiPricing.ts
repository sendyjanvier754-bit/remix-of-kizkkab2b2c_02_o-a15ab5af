// ============================================================================
// ZleTI pricing engine — single source of truth for the shipping estimate,
// volumetric weight and marketplace price suggestions.
// ============================================================================

export type MarketplaceCurrency = 'USD' | 'MXN' | 'EUR';
export type FeeType = 'percentage' | 'fixed';
export type FeeApplyTo = 'sale_price' | 'landed_cost';

export interface MarketplaceFee {
  id: string;
  marketplace_id?: string;
  name: string;
  fee_type: FeeType;
  value: number;
  apply_to: FeeApplyTo;
  sort_order: number;
}

export interface Marketplace {
  id: string;
  name: string;
  currency: MarketplaceCurrency;
  exchange_rate: number;
  target_profit_per_unit?: number;
  is_active: boolean;
  sort_order: number;
  fees: MarketplaceFee[];
}

export interface EstimateItemInput {
  id?: string;
  product_id?: string;
  variant_id?: string | null;
  product_name?: string;
  variant_name?: string | null;
  sku?: string;
  image_url?: string | null;
  quantity: number;
  unit_cost: number;
  weight_kg: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export interface ShippingConfig {
  rate: number;
  rateMode: 'kg' | 'g';
  extraExpenses: number;
  /** Volumetric divisor, cm³ per kg (air freight standard: 5000 or 6000). */
  volumetricDivisor: number;
  useVolumetric: boolean;
}

export const DEFAULT_VOLUMETRIC_DIVISOR = 5000;

/** Volume of one unit, in cm³. */
export const unitVolumeCm3 = (item: Pick<EstimateItemInput, 'length_cm' | 'width_cm' | 'height_cm'>) => {
  const l = Number(item.length_cm || 0);
  const w = Number(item.width_cm || 0);
  const h = Number(item.height_cm || 0);
  if (l <= 0 || w <= 0 || h <= 0) return 0;
  return l * w * h;
};

/** Volumetric weight of one unit, in kg. */
export const unitVolumetricWeightKg = (item: EstimateItemInput, divisor = DEFAULT_VOLUMETRIC_DIVISOR) => {
  const volume = unitVolumeCm3(item);
  if (volume <= 0 || divisor <= 0) return 0;
  return volume / divisor;
};

/** Chargeable weight of one unit: the greater of real and volumetric weight. */
export const unitChargeableWeightKg = (item: EstimateItemInput, config: ShippingConfig) => {
  const real = Math.max(0, Number(item.weight_kg || 0));
  if (!config.useVolumetric) return real;
  return Math.max(real, unitVolumetricWeightKg(item, config.volumetricDivisor));
};

export interface MarketplaceFeeTotals {
  percentageSalePrice: number;
  fixedFees: number;
  landedCostPercentage: number;
  denominator: number;
  viable: boolean;
}

export const getMarketplaceFeeTotals = (marketplace?: Marketplace | null): MarketplaceFeeTotals => {
  const fees = marketplace?.fees || [];
  const percentageSalePrice = fees
    .filter(fee => fee.fee_type === 'percentage' && fee.apply_to !== 'landed_cost')
    .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
  const landedCostPercentage = fees
    .filter(fee => fee.fee_type === 'percentage' && fee.apply_to === 'landed_cost')
    .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
  const fixedFees = fees
    .filter(fee => fee.fee_type === 'fixed')
    .reduce((sum, fee) => sum + Number(fee.value || 0), 0);
  const denominator = 1 - percentageSalePrice / 100;

  return {
    percentageSalePrice,
    fixedFees,
    landedCostPercentage,
    denominator,
    viable: percentageSalePrice < 100,
  };
};

export interface ShippingTotals {
  totalRealWeightKg: number;
  totalVolumetricWeightKg: number;
  totalChargeableWeightKg: number;
  totalVolumeCm3: number;
  shippingCost: number;
  extraExpenses: number;
  totalEstimate: number;
}

export const computeShippingTotals = (items: EstimateItemInput[], config: ShippingConfig): ShippingTotals => {
  let totalRealWeightKg = 0;
  let totalVolumetricWeightKg = 0;
  let totalChargeableWeightKg = 0;
  let totalVolumeCm3 = 0;

  items.forEach(item => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    totalRealWeightKg += Math.max(0, Number(item.weight_kg || 0)) * quantity;
    totalVolumetricWeightKg += unitVolumetricWeightKg(item, config.volumetricDivisor) * quantity;
    totalChargeableWeightKg += unitChargeableWeightKg(item, config) * quantity;
    totalVolumeCm3 += unitVolumeCm3(item) * quantity;
  });

  const rate = Number(config.rate || 0);
  const shippingCost = config.rateMode === 'kg'
    ? totalChargeableWeightKg * rate
    : totalChargeableWeightKg * 1000 * rate;
  const extraExpenses = Number(config.extraExpenses || 0);

  return {
    totalRealWeightKg,
    totalVolumetricWeightKg,
    totalChargeableWeightKg,
    totalVolumeCm3,
    shippingCost,
    extraExpenses,
    totalEstimate: shippingCost + extraExpenses,
  };
};

export interface PricedFee extends MarketplaceFee {
  amount: number;
}

export interface MarketplacePricing {
  marketplaceId: string;
  marketplaceName: string;
  currency: MarketplaceCurrency;
  exchangeRate: number;
  desiredProfit: number;
  landedUnitCostInCurrency: number;
  suggestedSalePrice: number;
  feeBreakdown: PricedFee[];
  totalDeductions: number;
  netReceived: number;
  netProfit: number;
  marginPercent: number;
  roiPercent: number;
  viable: boolean;
}

/**
 * Suggested sale price so that, after every fee, the seller keeps exactly
 * the desired profit per unit:
 *   price = (landedCost + landedCostFees + desiredProfit + fixedFees) / (1 - %saleFees)
 */
export const priceForMarketplace = (
  landedUnitCostUsd: number,
  marketplace: Marketplace,
  fallbackProfit = 0
): MarketplacePricing => {
  const totals = getMarketplaceFeeTotals(marketplace);
  const exchangeRate = Number(marketplace.exchange_rate || 1);
  const landedUnitCostInCurrency = Math.max(0, Number(landedUnitCostUsd || 0)) * exchangeRate;
  const desiredProfit = Number(marketplace.target_profit_per_unit ?? fallbackProfit ?? 0);
  const landedCostFees = landedUnitCostInCurrency * (totals.landedCostPercentage / 100);

  const suggestedSalePrice = totals.viable
    ? (landedUnitCostInCurrency + landedCostFees + desiredProfit + totals.fixedFees) / totals.denominator
    : 0;

  const feeBreakdown: PricedFee[] = (marketplace.fees || []).map(fee => {
    const amount = fee.fee_type === 'fixed'
      ? Number(fee.value || 0)
      : fee.apply_to === 'landed_cost'
        ? landedUnitCostInCurrency * Number(fee.value || 0) / 100
        : suggestedSalePrice * Number(fee.value || 0) / 100;
    return { ...fee, amount };
  });

  const totalDeductions = feeBreakdown.reduce((sum, fee) => sum + fee.amount, 0);
  const netReceived = suggestedSalePrice - totalDeductions;
  const netProfit = netReceived - landedUnitCostInCurrency;

  return {
    marketplaceId: marketplace.id,
    marketplaceName: marketplace.name,
    currency: marketplace.currency,
    exchangeRate,
    desiredProfit,
    landedUnitCostInCurrency,
    suggestedSalePrice,
    feeBreakdown,
    totalDeductions,
    netReceived,
    netProfit,
    marginPercent: suggestedSalePrice > 0 ? (netProfit / suggestedSalePrice) * 100 : 0,
    roiPercent: landedUnitCostInCurrency > 0 ? (netProfit / landedUnitCostInCurrency) * 100 : 0,
    viable: totals.viable,
  };
};

export interface EstimateLine {
  item: EstimateItemInput;
  quantity: number;
  unitWeightKg: number;
  unitVolumetricWeightKg: number;
  unitChargeableWeightKg: number;
  unitVolumeCm3: number;
  lineWeightKg: number;
  lineChargeableWeightKg: number;
  allocationShare: number;
  lineShippingTotal: number;
  shippingPerUnit: number;
  productCostUsd: number;
  landedUnitCost: number;
  lineLandedCost: number;
}

/** Allocates the shipping estimate across lines using chargeable weight. */
export const computeEstimateLines = (
  items: EstimateItemInput[],
  config: ShippingConfig,
  totals: ShippingTotals
): EstimateLine[] => {
  const totalQuantity = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  const useWeightAllocation = totals.totalChargeableWeightKg > 0;
  const allocationBase = useWeightAllocation ? totals.totalChargeableWeightKg : totalQuantity;

  return items.map(item => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const unitWeight = Math.max(0, Number(item.weight_kg || 0));
    const unitVolumetric = unitVolumetricWeightKg(item, config.volumetricDivisor);
    const unitChargeable = unitChargeableWeightKg(item, config);
    const lineChargeable = unitChargeable * quantity;
    const allocationWeight = useWeightAllocation ? lineChargeable : quantity;
    const allocationShare = allocationBase > 0 ? allocationWeight / allocationBase : 0;
    const lineShippingTotal = totals.totalEstimate * allocationShare;
    const shippingPerUnit = quantity > 0 ? lineShippingTotal / quantity : 0;
    const productCostUsd = Math.max(0, Number(item.unit_cost || 0));
    const landedUnitCost = productCostUsd + shippingPerUnit;

    return {
      item,
      quantity,
      unitWeightKg: unitWeight,
      unitVolumetricWeightKg: unitVolumetric,
      unitChargeableWeightKg: unitChargeable,
      unitVolumeCm3: unitVolumeCm3(item),
      lineWeightKg: unitWeight * quantity,
      lineChargeableWeightKg: lineChargeable,
      allocationShare,
      lineShippingTotal,
      shippingPerUnit,
      productCostUsd,
      landedUnitCost,
      lineLandedCost: landedUnitCost * quantity,
    };
  });
};

export const formatMoney = (amount: number, currency: MarketplaceCurrency | string = 'USD') =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);

export const formatMoneyWithCode = (amount: number, currency: MarketplaceCurrency | string = 'USD') =>
  `${formatMoney(amount, currency)} ${currency}`;
