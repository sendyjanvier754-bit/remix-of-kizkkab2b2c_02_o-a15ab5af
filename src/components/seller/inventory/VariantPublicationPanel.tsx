import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Image as ImageIcon } from "lucide-react";
import { useSellerVariantPublication } from "@/hooks/useSellerVariantPublication";
import { useTranslation } from "react-i18next";

interface VariantPublicationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string | null;
  sourceProductId: string | null;
  productName: string;
  defaultPrice: number;
  onSaved?: () => void;
}

export function VariantPublicationPanel({
  open,
  onOpenChange,
  catalogId,
  sourceProductId,
  productName,
  defaultPrice,
  onSaved,
}: VariantPublicationPanelProps) {
  const { t } = useTranslation();
  const { variants, isLoading, isSaving, updateVariant, saveAll } =
    useSellerVariantPublication(
      open ? catalogId : null,
      open ? sourceProductId : null,
      defaultPrice
    );

  const enabledCount = variants.filter((v) => v.isEnabled).length;
  const totalPurchased = variants.reduce((sum, v) => sum + v.purchasedStock, 0);

  const handleSave = async () => {
    const ok = await saveAll();
    if (ok) {
      onSaved?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b flex-shrink-0">
          <DialogTitle className="text-sm font-semibold">
            Gestionar variantes de venta
          </DialogTitle>
          <p className="text-xs font-medium text-foreground truncate">{productName}</p>
          <p className="text-[11px] text-muted-foreground">
            {totalPurchased} uds compradas • {variants.length} variante{variants.length !== 1 ? "s" : ""} disponible{variants.length !== 1 ? "s" : ""} • {enabledCount} activada{enabledCount !== 1 ? "s" : ""}
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))
          ) : variants.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay variantes disponibles para este producto</p>
            </div>
          ) : (
            variants.map((v) => (
              <div
                key={v.variantId}
                className={`rounded-lg border p-3 transition-colors ${
                  v.isEnabled
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30 opacity-60"
                }`}
              >
                {/* Top row: image + label + toggle */}
                <div className="flex items-start gap-3">
                  {/* Variant image */}
                  <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border bg-muted">
                    {v.images[0] ? (
                      <img
                        src={v.images[0]}
                        alt={v.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" />
                      </div>
                    )}
                  </div>

                  {/* Variant info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold truncate">{v.label}</p>
                      <Switch
                        checked={v.isEnabled}
                        onCheckedChange={(checked) =>
                          updateVariant(v.variantId, { isEnabled: checked })
                        }
                        className="flex-shrink-0"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      SKU: {v.sku}
                    </p>
                    <Badge
                      variant={v.purchasedStock === 0 ? "destructive" : "secondary"}
                      className="text-[9px] mt-1 h-4 px-1.5"
                    >
                      Stock comprado: {v.purchasedStock}
                    </Badge>
                  </div>
                </div>

                {/* Expanded controls when enabled */}
                {v.isEnabled && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {/* Stock to sell */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                        Cantidad a vender
                      </label>
                      <Input
                        type="number"
                        min={0}
                        max={v.purchasedStock}
                        value={v.stockToSell}
                        onChange={(e) =>
                          updateVariant(v.variantId, {
                            stockToSell: Math.min(
                              v.purchasedStock,
                              Math.max(0, parseInt(e.target.value) || 0)
                            ),
                          })
                        }
                        className="h-8 text-xs"
                        placeholder="0"
                      />
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        Máx: {v.purchasedStock}
                      </p>
                    </div>

                    {/* Price override */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                        Precio de venta B2C
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={v.priceOverride}
                          onChange={(e) =>
                            updateVariant(v.variantId, {
                              priceOverride: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs pl-5"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 py-3 border-t flex-shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 text-xs"
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex-1 h-9 text-xs"
          >
            {isSaving ? "Guardando..." : `Guardar cambios (${enabledCount} activa${enabledCount !== 1 ? "s" : ""})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
