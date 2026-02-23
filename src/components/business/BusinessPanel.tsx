import React from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';

// Type for v_business_panel_data row
export interface BusinessPanelDataRow {
  product_id?: string;
  variant_id?: string | null;
  item_name?: string;
  sku?: string;
  item_type?: 'product' | 'variant';
  cost_per_unit: number;
  weight_kg?: number;
  shipping_cost_per_unit?: number | null;
  suggested_pvp_per_unit: number | null;
  investment_1unit: number;
  revenue_1unit: number | null;
  profit_1unit: number | null;
  margin_percentage: number | null;
}

export interface BusinessPanelProps {
  /** Total investment (precio_b2b × quantity) */
  investment: number;
  /** Suggested retail price per unit (PVP) */
  suggestedPricePerUnit: number;
  /** Total quantity being purchased */
  quantity: number;
  /** Optional: Data from v_business_panel_data (takes precedence) */
  businessPanelData?: BusinessPanelDataRow;
  /** Optional: Show compact version */
  compact?: boolean;
  /** Optional: Custom className */
  className?: string;
}

/**
 * BusinessPanel (p_negocio)
 * Reusable component to display business metrics for B2B transactions
 * 
 * Data source: v_business_panel_data (preferred) or individual props
 * 
 * When businessPanelData is provided, uses:
 * - investment_1unit as cost per unit
 * - suggested_pvp_per_unit as selling price per unit
 * - profit_1unit as profit per unit
 * - margin_percentage for margin display
 * 
 * Calculations:
 * - Investment: cost_per_unit × quantity
 * - Suggested Sale: suggested_pvp × quantity
 * - Profit: suggested_pvp - cost - shipping
 * - Margin: From view calculation
 */
export const BusinessPanel: React.FC<BusinessPanelProps> = ({
  investment,
  suggestedPricePerUnit,
  quantity,
  businessPanelData,
  compact = false,
  className = ''
}) => {
  // Use businessPanelData if provided, otherwise fall back to props
  const costPerUnit = businessPanelData 
    ? businessPanelData.investment_1unit 
    : (quantity > 0 ? investment / quantity : 0);
  
  const pvpPerUnit = businessPanelData
    ? businessPanelData.suggested_pvp_per_unit
    : suggestedPricePerUnit;
  
  const profitPerUnit = businessPanelData
    ? businessPanelData.profit_1unit
    : (pvpPerUnit - costPerUnit);
  
  const marginPercentage = businessPanelData
    ? businessPanelData.margin_percentage
    : (costPerUnit > 0 ? ((pvpPerUnit - costPerUnit) / costPerUnit * 100) : 0);
  
  const shippingPerUnit = businessPanelData?.shipping_cost_per_unit ?? 0;

  // Detect missing market/tier configuration: DB returns NULL for shipped cost
  const noMarketConfigured =
    businessPanelData !== undefined &&
    businessPanelData.shipping_cost_per_unit === null;

  // Calculate totals
  const estimatedRevenue = (pvpPerUnit ?? 0) * quantity;
  const estimatedProfit = (profitPerUnit ?? 0) * quantity;
  const totalInvestment = costPerUnit * quantity;

  if (quantity <= 0) return null;

  if (noMarketConfigured) {
    return (
      <div className={`p-3 bg-amber-50 rounded-lg border border-amber-300 ${className}`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Mercado de envío no configurado</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Configura tu mercado de envío en <span className="font-semibold">Mi Cuenta → Mercado de Envío</span> para ver el análisis de negocio.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 bg-muted/50 rounded-lg border border-border ${className}`}>
      <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
        Panel de Negocio
      </h5>
      <div className={`space-y-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Inversión ({quantity} uds):</span>
          <span className="font-bold text-foreground">${totalInvestment.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Venta sugerida (PVP):</span>
          <span className="font-bold text-foreground">${estimatedRevenue.toFixed(2)}</span>
        </div>
        {!compact && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Precio unitario sugerido:</span>
            <span>${(pvpPerUnit ?? 0).toFixed(2)}</span>
          </div>
        )}
        {!compact && shippingPerUnit > 0 && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Costo de logística incluido:</span>
            <span>${shippingPerUnit.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-border">
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Ganancia estimada:
          </span>
          <div className="text-right">
            <span className="font-bold text-green-600">+${estimatedProfit.toFixed(2)}</span>
            <div className="text-[10px] text-muted-foreground">
              {typeof marginPercentage === 'number' ? marginPercentage.toFixed(1) : '0.0'}% margen · ${(profitPerUnit ?? 0).toFixed(2)}/ud
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessPanel;
