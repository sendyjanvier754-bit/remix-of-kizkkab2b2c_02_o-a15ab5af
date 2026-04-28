import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useB2BPriceCalculator } from '@/hooks/useB2BPriceCalculator';
import { Loader2, Package, Truck, DollarSign, TrendingUp, FileSpreadsheet, Globe, Layers } from 'lucide-react';

interface PriceBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  sku: string;
  productName: string;
  factoryCost: number; // precio_mayorista_base from Excel (fallback)
  weight_g?: number | null;
  categoryId?: string | null;
}

interface DestinationRow {
  id: string;
  code: string;
  name: string;
  currency: string;
}

interface ProductPriceRow {
  costo_base: number | null;
  precio_b2b: number | null;
  applied_margin_percent: number | null;
  margin_value: number | null;
  platform_fee: number | null;
  platform_fee_percent: number | null;
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
  // Fetch the SQL-engine price (uses b2b_margin_ranges + configured platform_fee)
  const { data: priceRow, isLoading: loadingPrice } = useQuery({
    queryKey: ['product-b2b-price-row', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_productos_con_precio_b2b' as any)
        .select('costo_base, precio_b2b, applied_margin_percent, margin_value, platform_fee, platform_fee_percent')
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as ProductPriceRow | null;
    },
    enabled: open,
  });

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

  const costoBase = Number(priceRow?.costo_base ?? factoryCost) || 0;
  const precioB2B = Number(priceRow?.precio_b2b ?? 0) || 0;
  const marginPercent = Number(priceRow?.applied_margin_percent ?? 0) || 0;
  const marginValue = Number(priceRow?.margin_value ?? 0) || 0;
  const platformFee = Number(priceRow?.platform_fee ?? 0) || 0;
  const platformFeePercent = Number(priceRow?.platform_fee_percent ?? 0) || 0;

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

        {/* Costo origen + Precio B2B base (motor SQL unificado) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-primary">
                <FileSpreadsheet className="h-4 w-4" />
                Costo de origen (Excel)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">${costoBase.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">USD/u</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lo que costó comprar este SKU según el Excel.
                {weight_g ? ` Peso: ${weight_g}g.` : ' (Peso por defecto: 500g.)'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-300/40 bg-emerald-50/40 dark:bg-emerald-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Layers className="h-4 w-4" />
                Precio B2B base (sin logística)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingPrice ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                      ${precioB2B.toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground">USD/u</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Costo + Margen ({marginPercent}% según rangos B2B) + Platform fee ({platformFeePercent.toFixed(0)}%).
                  </p>
                  <div className="text-[11px] text-muted-foreground mt-1 space-x-2">
                    <span>Margen: ${marginValue.toFixed(2)}</span>
                    <span>·</span>
                    <span>Platform fee: ${platformFee.toFixed(2)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Por mercado */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Globe className="h-4 w-4" />
            Precio aterrizado por mercado (Precio B2B + Logística)
          </div>

          {loadingDest || loadingPrice ? (
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
                precioB2B={precioB2B}
                weightKg={weightKg}
                categoryId={categoryId || undefined}
                productId={productId}
                factoryCost={costoBase}
              />
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3 mt-2">
          💡 El <strong>Precio B2B base</strong> proviene del motor SQL unificado y aplica los rangos de márgenes B2B y el platform fee configurados en <em>Admin → Configuración de Precios</em>. Para cada mercado solo se añade la logística por ruta y las tarifas de categoría. El PVP sugerido aplica un multiplicador 2.5x sobre el precio aterrizado.
        </p>
      </DialogContent>
    </Dialog>
  );
};

interface DestinationBreakdownRowProps {
  destination: DestinationRow;
  precioB2B: number;
  factoryCost: number;
  weightKg: number;
  categoryId?: string;
  productId: string;
}

const DestinationBreakdownRow = ({
  destination,
  precioB2B,
  factoryCost,
  weightKg,
  categoryId,
  productId,
}: DestinationBreakdownRowProps) => {
  // We still use the calculator hook ONLY for logistics + category fees per market.
  const { calculateProductPrice } = useB2BPriceCalculator(destination.code);

  const result = calculateProductPrice(
    {
      id: productId,
      factoryCost, // used internally for category fee % computation
      categoryId,
      weight: weightKg,
    },
    destination.code
  );

  const logisticsCost = result.logisticsCost;
  const categoryFees = result.categoryFees;
  const landedB2B = Math.round((precioB2B + logisticsCost + categoryFees) * 100) / 100;
  const suggestedPVP = Math.round(landedB2B * 2.5 * 100) / 100;
  const profit = Math.round((suggestedPVP - landedB2B) * 100) / 100;
  const roi = landedB2B > 0 ? Math.round((profit / landedB2B) * 1000) / 10 : 0;

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
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Precio B2B base"
            value={precioB2B}
          />
          <BreakdownLine
            icon={<Truck className="h-3.5 w-3.5" />}
            label="Logística"
            value={logisticsCost}
            muted={logisticsCost === 0}
          />
          <BreakdownLine
            icon={<Package className="h-3.5 w-3.5" />}
            label="Tarifas categoría"
            value={categoryFees}
            muted={categoryFees === 0}
          />
          <BreakdownLine
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Total aterrizado"
            value={landedB2B}
          />
        </div>

        {!result.logistics && (
          <div className="text-[11px] rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-2 py-1.5">
            ⚠️ No hay ruta de envío activa configurada para este mercado. La logística se calcula como $0.00. Configúrala en <strong>Admin → Configuración de Precios → Rutas</strong>.
          </div>
        )}

        <div className="border-t pt-2 grid grid-cols-2 gap-3">
          <div className="bg-muted/40 rounded p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Precio B2B aterrizado</p>
            <p className="text-lg font-semibold">${landedB2B.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2 border border-emerald-200 dark:border-emerald-900">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">PVP sugerido</p>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              ${suggestedPVP.toFixed(2)}
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              Ganancia: ${profit.toFixed(2)} ({roi}%)
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
