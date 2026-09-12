import { BarChart3, CheckCircle2, Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeaturedTrendingStore } from "@/hooks/useFeaturedTrendingStore";

interface FeaturedTrendingStorePanelProps {
  canEdit: boolean;
}

const formatTotals = (totals: Record<string, number>) => {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "Sin compras";
  return entries
    .map(([currency, value]) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`)
    .join(" · ");
};

export const FeaturedTrendingStorePanel = ({ canEdit }: FeaturedTrendingStorePanelProps) => {
  const {
    stores,
    selectedStore,
    metrics,
    isLoading,
    metricsLoading,
    selectStore,
    activeSelections,
  } = useFeaturedTrendingStore();
  const [duration, setDuration] = useState("0");
  const [storePendingActivation, setStorePendingActivation] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <section className="rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 via-white to-purple-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold text-foreground">Tienda destacada en Tendencias</h2>
            {selectedStore && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Visible</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta el catálogo y la actividad de compras de la tienda seleccionada.
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="mt-5 divide-y rounded-lg bg-white">
          {stores.map((store) => {
            const selection = activeSelections.find((item) => item.storeId === store.id);
            const checked = Boolean(selection);
            return (
              <div key={store.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{store.name}</p>
                  <p className="text-xs text-muted-foreground">{checked ? (selection?.expiresAt ? `Activa hasta ${new Date(selection.expiresAt).toLocaleString()}` : "Activa indefinidamente") : "No destacada"}</p>
                </div>
                <Switch
                  checked={checked}
                  disabled={selectStore.isPending}
                  onCheckedChange={(enabled) => {
                    if (enabled) {
                      setDuration("0");
                      setStorePendingActivation(store.id);
                    } else {
                      selectStore.mutate({ storeId: store.id, enabled: false, durationMinutes: null });
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {!canEdit && !selectedStore ? (
        <div className="mt-5 rounded-lg border border-dashed bg-white/70 p-5 text-sm text-muted-foreground">
          No hay una tienda seleccionada para destacar.
        </div>
      ) : selectedStore ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-white p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><Package className="h-4 w-4" /> Productos activos</div>
            <p className="mt-2 text-2xl font-bold">{metricsLoading ? "…" : metrics?.productCount ?? 0}</p>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><ShoppingCart className="h-4 w-4" /> Compras realizadas</div>
            <p className="mt-2 text-2xl font-bold">{metricsLoading ? "…" : metrics?.purchaseCount ?? 0}</p>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Unidades compradas</div>
            <p className="mt-2 text-2xl font-bold">{metricsLoading ? "…" : metrics?.purchaseQuantity ?? 0}</p>
          </div>
          <div className="rounded-lg bg-white p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><BarChart3 className="h-4 w-4" /> Total comprado</div>
            <p className="mt-2 text-lg font-bold">{metricsLoading ? "…" : formatTotals(metrics?.totalsByCurrency || {})}</p>
          </div>
        </div>
      ) : null}

      <Dialog
        open={!!storePendingActivation}
        onOpenChange={(open) => !open && setStorePendingActivation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar tiempo activo</DialogTitle>
            <DialogDescription>
              Elige cuánto tiempo se mostrará esta tienda en Tendencias.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Indefinido</SelectItem>
                <SelectItem value="1">1 minuto</SelectItem>
                <SelectItem value="10">10 minutos</SelectItem>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="360">6 horas</SelectItem>
                <SelectItem value="1440">24 horas</SelectItem>
                <SelectItem value="10080">7 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStorePendingActivation(null)}>
              Cancelar
            </Button>
            <Button
              disabled={selectStore.isPending || !storePendingActivation}
              onClick={() => {
                if (!storePendingActivation) return;
                selectStore.mutate({
                  storeId: storePendingActivation,
                  enabled: true,
                  durationMinutes: duration === "0" ? null : Number(duration),
                }, { onSuccess: () => setStorePendingActivation(null) });
              }}
            >
              Activar tienda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
