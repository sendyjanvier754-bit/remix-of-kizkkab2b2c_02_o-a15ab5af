import { Package, Truck, Calculator, Scale, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { B2BCheckoutSummary, MultitramoPrice } from '@/types/b2b-shipping';

interface B2BOrderSummaryProps {
  summary: {
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
  itemCount: number;
  shippingType: 'standard' | 'express';
  zoneName?: string;
  zoneLevel?: number;
  loading?: boolean;
}

export function B2BOrderSummary({
  summary,
  itemCount,
  shippingType,
  zoneName = 'Default',
  zoneLevel = 1,
  loading = false,
}: B2BOrderSummaryProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatWeight = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(2)} kg`;
    }
    return `${grams.toFixed(0)} g`;
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="text-lg">Resumen del Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <Separator />
          <div className="h-6 bg-muted rounded w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Resumen del Pedido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items y tipo de envío */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4" />
            Productos ({itemCount} items)
          </span>
          <Badge variant={shippingType === 'express' ? 'default' : 'secondary'}>
            {shippingType === 'express' ? '⚡ Express' : '📦 Estándar'}
          </Badge>
        </div>

        <Separator />

        {/* Subtotal Productos */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal Productos</span>
          <span className="font-medium">{formatPrice(summary.subtotal_products)}</span>
        </div>

        {/* Envío Internacional */}
        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Truck className="h-4 w-4" />
            Envío Internacional
          </div>
          
          <div className="flex justify-between text-sm pl-6">
            <span className="text-muted-foreground">Tramo A (China→USA)</span>
            <span className="font-medium text-blue-600">
              {formatPrice(summary.subtotal_shipping * 0.6)} {/* Aproximación Tramo A */}
            </span>
          </div>
          
          <div className="flex justify-between text-sm pl-6">
            <span className="text-muted-foreground">Tramo B (USA→Destino)</span>
            <span className="font-medium text-blue-600">
              {formatPrice(summary.subtotal_shipping * 0.4)} {/* Aproximación Tramo B */}
            </span>
          </div>

          <div className="flex justify-between text-sm pl-6 pt-1 border-t border-border">
            <span className="text-muted-foreground">Logística Total</span>
            <span className="font-semibold">{formatPrice(summary.subtotal_shipping)}</span>
          </div>
        </div>

        {/* Desglose de Peso */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
            <Scale className="h-4 w-4" />
            Desglose de Peso
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white dark:bg-background p-2 rounded">
              <div className="text-xs text-muted-foreground">Peso Real</div>
              <div className="font-semibold">{formatWeight(summary.total_weight_g)}</div>
            </div>
            <div className="bg-white dark:bg-background p-2 rounded">
              <div className="text-xs text-muted-foreground">Peso Facturable</div>
              <div className="font-semibold">
                {summary.billable_weight_kg} kg / {summary.billable_weight_lb} lb
              </div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            El peso facturable se redondea al entero superior (mín. 1)
          </div>
        </div>

        {/* Recargos */}
        {summary.recargos_total > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Recargos (Zona {zoneLevel}: {zoneName})
            </span>
            <span className="font-medium text-amber-600">
              +{formatPrice(summary.recargos_total)}
            </span>
          </div>
        )}

        {/* Badges de clasificación */}
        {(summary.has_oversize || summary.has_sensitive) && (
          <div className="flex flex-wrap gap-2">
            {summary.has_oversize && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                📦 Incluye Oversize
              </Badge>
            )}
            {summary.has_sensitive && (
              <Badge variant="outline" className="text-red-600 border-red-300">
                ⚠️ Incluye Sensible
              </Badge>
            )}
          </div>
        )}

        {/* Platform Fee */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fee Plataforma (12%)</span>
          <span className="font-medium">{formatPrice(summary.platform_fees)}</span>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-lg font-bold">TOTAL A PAGAR</span>
          <span className="text-2xl font-bold text-primary">
            {formatPrice(summary.total_amount)}
          </span>
        </div>

        {/* ETA */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
          <Clock className="h-4 w-4" />
          <span>Entrega estimada:</span>
          <span className="font-semibold text-foreground">
            {summary.eta_min}-{summary.eta_max} días
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default B2BOrderSummary;
