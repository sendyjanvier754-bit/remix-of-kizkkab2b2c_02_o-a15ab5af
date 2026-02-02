import { Scale, ArrowRight, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GRAMS_TO_KG, GRAMS_TO_LB, roundUpWeight } from '@/types/b2b-shipping';

interface B2BWeightBreakdownProps {
  totalWeightG: number;
  billableWeightKg: number;
  billableWeightLb: number;
  hasOversizeProducts?: boolean;
  volumetricWeightKg?: number;
  compact?: boolean;
}

export function B2BWeightBreakdown({
  totalWeightG,
  billableWeightKg,
  billableWeightLb,
  hasOversizeProducts = false,
  volumetricWeightKg,
  compact = false,
}: B2BWeightBreakdownProps) {
  const realWeightKg = totalWeightG / GRAMS_TO_KG;
  const realWeightLb = totalWeightG / GRAMS_TO_LB;
  
  // Determinar si se usa peso volumétrico
  const usesVolumetric = hasOversizeProducts && volumetricWeightKg && volumetricWeightKg > realWeightKg;

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-help">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Peso:</span>
                <span className="font-medium">
                  {(totalWeightG / 1000).toFixed(2)} kg
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="secondary" className="font-semibold">
                  {billableWeightKg} kg / {billableWeightLb} lb
                </Badge>
                <Info className="h-3 w-3 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Peso real → Peso facturable (redondeado)</p>
              <p className="text-xs text-muted-foreground">
                Tramo A: {billableWeightKg} kg | Tramo B: {billableWeightLb} lb
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Desglose de Peso
          {usesVolumetric && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
              Volumétrico aplicado
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Peso Real */}
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Peso Real</div>
            <div className="font-bold text-lg">{totalWeightG.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">gramos</div>
            <div className="text-sm text-muted-foreground mt-1">
              ({realWeightKg.toFixed(2)} kg)
            </div>
          </div>

          {/* Flecha de conversión */}
          <div className="flex flex-col items-center justify-center">
            <ArrowRight className="h-6 w-6 text-primary" />
            <span className="text-xs text-muted-foreground mt-1">
              Math.ceil()
            </span>
          </div>

          {/* Peso Facturable */}
          <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/30">
            <div className="text-xs text-muted-foreground mb-1">Peso Facturable</div>
            <div className="font-bold text-lg text-primary">{billableWeightKg}</div>
            <div className="text-xs text-muted-foreground">kg (Tramo A)</div>
            <div className="font-bold text-primary mt-1">{billableWeightLb}</div>
            <div className="text-xs text-muted-foreground">lb (Tramo B)</div>
          </div>
        </div>

        {/* Explicación */}
        <div className="mt-4 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <p className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            <strong>Tramo A (China→USA):</strong> Se factura en KG (g ÷ 1000, redondeado)
          </p>
          <p className="flex items-center gap-1 mt-1">
            <Info className="h-3 w-3" />
            <strong>Tramo B (USA→Destino):</strong> Se factura en LB (g ÷ 453.59, redondeado)
          </p>
          <p className="mt-1 text-amber-600">
            El peso mínimo facturable es 1 (kg o lb según el tramo).
          </p>
        </div>

        {/* Info Volumétrico si aplica */}
        {usesVolumetric && volumetricWeightKg && (
          <div className="mt-3 text-xs bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200">
            <p className="text-amber-700 dark:text-amber-400">
              <strong>Peso Volumétrico:</strong> {volumetricWeightKg.toFixed(2)} kg
            </p>
            <p className="text-amber-600 dark:text-amber-500 mt-1">
              Se aplica el mayor entre peso real y volumétrico para productos oversize.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default B2BWeightBreakdown;
