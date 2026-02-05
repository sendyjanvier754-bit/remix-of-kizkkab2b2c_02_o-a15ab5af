import React from 'react';
import { TrendingUp } from 'lucide-react';

export interface BusinessPanelProps {
  /** Total investment (precio_b2b × quantity) */
  investment: number;
  /** Suggested retail price per unit (PVP) */
  suggestedPricePerUnit: number;
  /** Total quantity being purchased */
  quantity: number;
  /** Optional: Show compact version */
  compact?: boolean;
  /** Optional: Custom className */
  className?: string;
}

/**
 * BusinessPanel (p_negocio)
 * Reusable component to display business metrics for B2B transactions
 * 
 * Calculations:
 * - Investment: precio_b2b × quantity (what you pay)
 * - Suggested Sale: PVP × quantity (suggested retail revenue)
 * - Profit: (PVP - precio_b2b) × quantity
 * - Margin: ((PVP - precio_b2b) / precio_b2b) × 100%
 */
export const BusinessPanel: React.FC<BusinessPanelProps> = ({
  investment,
  suggestedPricePerUnit,
  quantity,
  compact = false,
  className = ''
}) => {
  // Calculate business metrics
  const estimatedRevenue = suggestedPricePerUnit * quantity;
  const estimatedProfit = estimatedRevenue - investment;
  const costPerUnit = quantity > 0 ? investment / quantity : 0;
  const profitPercentage = costPerUnit > 0 
    ? ((suggestedPricePerUnit - costPerUnit) / costPerUnit * 100).toFixed(1)
    : '0.0';
  const profitPerUnit = suggestedPricePerUnit - costPerUnit;

  if (quantity <= 0) return null;

  return (
    <div className={`p-3 bg-muted/50 rounded-lg border border-border ${className}`}>
      <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
        Panel de Negocio
      </h5>
      <div className={`space-y-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Inversión ({quantity} uds):</span>
          <span className="font-bold text-foreground">${investment.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Venta sugerida (PVP):</span>
          <span className="font-bold text-foreground">${estimatedRevenue.toFixed(2)}</span>
        </div>
        {!compact && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Precio unitario sugerido:</span>
            <span>${suggestedPricePerUnit.toFixed(2)}</span>
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
              {profitPercentage}% margen · ${profitPerUnit.toFixed(2)}/ud
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessPanel;
