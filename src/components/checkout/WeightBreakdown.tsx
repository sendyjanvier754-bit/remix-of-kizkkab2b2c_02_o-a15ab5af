import { Scale, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { MultitramoPrice } from '@/types/b2b-shipping';

interface WeightBreakdownProps {
  pesoRealG: number;
  pesoFacturableKg: number;
  pesoFacturableLb: number;
  isOversize?: boolean;
  pesoVolumetrico?: number;
  className?: string;
}

/**
 * WeightBreakdown
 * 
 * Muestra desglose transparente de:
 * - Peso real del producto
 * - Peso facturable (con redondeo Math.ceil)
 * - Diferencia por redondeo
 * - Peso volumétrico (si aplica)
 */
export function WeightBreakdown({
  pesoRealG,
  pesoFacturableKg,
  pesoFacturableLb,
  isOversize = false,
  pesoVolumetrico,
  className,
}: WeightBreakdownProps) {
  const pesoRealKg = pesoRealG / 1000;
  const pesoRealLb = pesoRealG / 453.592;
  const diferenciaKg = pesoFacturableKg - pesoRealKg;
  const diferenciaLb = pesoFacturableLb - pesoRealLb;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Desglose de Peso
          {isOversize && (
            <Badge variant="secondary" className="text-xs">
              Oversize
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Peso Real */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" />
              Peso Real
            </span>
            <span className="font-medium">{pesoRealG.toFixed(0)}g</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground pl-5">
            <span>Tramo A (kg)</span>
            <span>{pesoRealKg.toFixed(3)} kg</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground pl-5">
            <span>Tramo B (lb)</span>
            <span>{pesoRealLb.toFixed(3)} lb</span>
          </div>
        </div>

        <Separator />

        {/* Peso Volumétrico (si aplica) */}
        {isOversize && pesoVolumetrico !== undefined && (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Peso Volumétrico
                </span>
                <span className="font-medium text-amber-600">
                  {pesoVolumetrico.toFixed(3)} kg
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Producto oversize: se cobra el mayor entre peso real y volumétrico
              </p>
            </div>
            <Separator />
          </>
        )}

        {/* Peso Facturable (con redondeo) */}
        <div className="space-y-1 bg-primary/5 p-2 rounded-lg">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-primary flex items-center gap-1">
              <Scale className="h-3 w-3" />
              Peso Facturable
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pl-5">
            <span>Tramo A (redondeado ↑)</span>
            <span className="font-bold">{pesoFacturableKg.toFixed(0)} kg</span>
          </div>
          <div className="flex items-center justify-between text-xs pl-5">
            <span>Tramo B (redondeado ↑)</span>
            <span className="font-bold">{pesoFacturableLb.toFixed(0)} lb</span>
          </div>
        </div>

        {/* Explicación de redondeo */}
        {(diferenciaKg > 0.1 || diferenciaLb > 0.1) && (
          <div className="text-xs text-muted-foreground flex items-start gap-2 bg-blue-50 p-2 rounded">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Redondeo Agrupado</p>
              <p>
                El peso se redondea al mayor (Math.ceil) para cada tramo:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Tramo A: +{diferenciaKg.toFixed(3)} kg de redondeo</li>
                <li>Tramo B: +{diferenciaLb.toFixed(3)} lb de redondeo</li>
              </ul>
            </div>
          </div>
        )}

        {/* Nota sobre mínimo facturable */}
        {pesoRealG < 200 && (
          <div className="text-xs text-amber-600 flex items-start gap-2 bg-amber-50 p-2 rounded">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <p>
              <span className="font-medium">Peso mínimo facturable:</span> 200g por producto
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WeightBreakdown;
