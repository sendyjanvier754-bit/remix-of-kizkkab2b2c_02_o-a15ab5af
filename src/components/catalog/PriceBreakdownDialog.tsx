import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useB2BPriceCalculator } from '@/hooks/useB2BPriceCalculator';
import { Loader2, Package, Truck, DollarSign, TrendingUp, FileSpreadsheet, Globe } from 'lucide-react';

interface PriceBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  sku: string;
  productName: string;
  factoryCost: number; // precio_mayorista_base from Excel
  weight_g?: number | null;
  categoryId?: string | null;
}

interface DestinationRow {
  id: string;
  code: string;
  name: string;
  currency: string;
}

const PriceBreakdownDialog = ({
  open,
  onOpenChange,
  productId,
  sku,
  productName,
  factoryCost,
  weight_g,
  categoryId,
}: PriceBreakdownDialogProps) => {
  // Fetch active destinations (markets/regions)
  const { data: destinations = [], isLoading: loadingDest } = useQuery({
    queryKey: ['active-destinations-breakdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('destination_countries')
        .select('id, code, name, currency')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as DestinationRow[];
    },
    enabled: open,
  });

  const weightKg = weight_g ? weight_g / 1000 : 0.5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Desglose de Precios por Mercado
          </DialogTitle>
          <DialogDescription>
            <span className="block">{productName}</span>
            <Badge variant="outline" className="mt-1">SKU: {sku}</Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Costo origen (Excel) */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <FileSpreadsheet className="h-4 w-4" />
              Costo de origen (importado del Excel)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">${factoryCost.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">USD por unidad</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lo que costó comprar este SKU según los datos cargados.
              {weight_g ? ` Peso: ${weight_g}g.` : ' (Peso por defecto: 500g.)'}
            </p>
          </CardContent>
        </Card>

        {/* Por mercado */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Globe className="h-4 w-4" />
            Precio de venta sugerido por mercado
          </div>

          {loadingDest ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay mercados activos configurados.
            </p>
          ) : (
            destinations.map((dest) => (
              <DestinationBreakdownRow
                key={dest.id}
                destination={dest}
                factoryCost={factoryCost}
                weightKg={weightKg}
                categoryId={categoryId || undefined}
                productId={productId}
              />
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3 mt-2">
          💡 El precio se calcula con la regla de protección: margen sobre el costo de fábrica + logística por ruta + tarifas de categoría. El PVP sugerido aplica un multiplicador 2.5x sobre el precio B2B final.
        </p>
      </DialogContent>
    </Dialog>
  );
};

interface DestinationBreakdownRowProps {
  destination: DestinationRow;
  factoryCost: number;
  weightKg: number;
  categoryId?: string;
  productId: string;
}

const DestinationBreakdownRow = ({
  destination,
  factoryCost,
  weightKg,
  categoryId,
  productId,
}: DestinationBreakdownRowProps) => {
  const { calculateProductPrice } = useB2BPriceCalculator(destination.code);

  const result = calculateProductPrice(
    {
      id: productId,
      factoryCost,
      categoryId,
      weight: weightKg,
    },
    destination.code
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {destination.name}
            <Badge variant="secondary" className="text-xs">{destination.code}</Badge>
          </span>
          <span className="text-xs text-muted-foreground font-normal">{destination.currency}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <BreakdownLine
            icon={<Package className="h-3.5 w-3.5" />}
            label="Costo origen"
            value={factoryCost}
          />
          <BreakdownLine
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label={`Margen (${result.marginPercent}%)`}
            value={result.marginValue}
          />
          <BreakdownLine
            icon={<Truck className="h-3.5 w-3.5" />}
            label="Logística"
            value={result.logisticsCost}
            muted={result.logisticsCost === 0}
          />
          <BreakdownLine
            icon={<Package className="h-3.5 w-3.5" />}
            label="Tarifas categoría"
            value={result.categoryFees}
            muted={result.categoryFees === 0}
          />
        </div>

        {!result.logistics && (
          <div className="text-[11px] rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-2 py-1.5">
            ⚠️ No hay ruta de envío activa configurada para este mercado. La logística se calcula como $0.00. Configúrala en <strong>Admin → Configuración de Precios → Rutas</strong>.
          </div>
        )}

        <div className="border-t pt-2 grid grid-cols-2 gap-3">
          <div className="bg-muted/40 rounded p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Precio B2B final</p>
            <p className="text-lg font-semibold">${result.finalB2BPrice.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2 border border-emerald-200 dark:border-emerald-900">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">PVP sugerido</p>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              ${result.suggestedPVP.toFixed(2)}
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              Ganancia: ${result.profitAmount.toFixed(2)} ({result.roiPercent}%)
            </p>
          </div>
        </div>

        {result.logistics && (
          <p className="text-[11px] text-muted-foreground">
            Ruta: {result.logistics.routeName} · {result.logistics.estimatedDays.min}-{result.logistics.estimatedDays.max} días
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const BreakdownLine = ({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  muted?: boolean;
}) => (
  <div className={`flex items-center justify-between ${muted ? 'text-muted-foreground' : ''}`}>
    <span className="flex items-center gap-1.5">
      {icon}
      {label}
    </span>
    <span className="font-medium">${value.toFixed(2)}</span>
  </div>
);

export default PriceBreakdownDialog;
