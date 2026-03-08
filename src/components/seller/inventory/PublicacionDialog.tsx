import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MarginAlert } from "./MarginAlert";
import { SellerCatalogItem } from "@/hooks/useSellerCatalog";
import { useTranslation } from "react-i18next";

interface PublicacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SellerCatalogItem | null;
  onSave: (itemId: string, precioVenta: number, isActive: boolean) => Promise<boolean>;
}

export function PublicacionDialog({ open, onOpenChange, item, onSave }: PublicacionDialogProps) {
  const { t } = useTranslation();
  const [precioVenta, setPrecioVenta] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setPrecioVenta(item.precioVenta.toString());
      setIsActive(item.isActive);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    const precio = parseFloat(precioVenta);
    if (isNaN(precio) || precio < 0) return;

    setIsSaving(true);
    const success = await onSave(item.id, precio, isActive);
    setIsSaving(false);
    if (success) onOpenChange(false);
  };

  if (!item) return null;

  const precioNumerico = parseFloat(precioVenta) || 0;
  const margin = item.precioCosto > 0 
    ? ((precioNumerico - item.precioCosto) / item.precioCosto) * 100 
    : 0;
  const gananciaUnitaria = precioNumerico - item.precioCosto;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden p-3">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm">{t('publicacionDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-w-full">
          <div className="flex gap-2 items-start">
            {item.images[0] && (
              <img src={item.images[0]} alt={item.nombre} className="w-10 h-10 object-cover rounded flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-xs leading-tight truncate">{item.nombre}</h4>
              <div className="flex flex-wrap gap-x-1.5 text-[9px] text-muted-foreground mt-0.5">
                <span className="truncate max-w-[120px]">SKU: {item.sku}</span>
                <span>•</span>
                <span className="whitespace-nowrap">Stock: {item.stock}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-2 space-y-2.5">
            <div>
              <h4 className="text-[11px] font-semibold mb-1.5 text-gray-700">{t('publicacionDialog.costs')}</h4>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2.5 space-y-1">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] text-blue-900">{t('publicacionDialog.b2bPrice')}</span>
                  <span className="font-semibold text-xs text-blue-900">${item.precioB2B.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] text-blue-900">{t('publicacionDialog.logistics', { weight: item.weightKg })}</span>
                  <span className="font-semibold text-xs text-blue-900">${item.costoLogistica.toFixed(2)}</span>
                </div>
                <div className="border-t border-blue-300 pt-1 mt-1">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] font-bold text-blue-950">{t('publicacionDialog.totalInvested')}</span>
                    <span className="text-sm font-bold text-blue-950">${item.precioCosto.toFixed(2)}</span>
                  </div>
                </div>
                {item.costoLogistica === 0 && (
                  <div className="mt-1 text-[9px] text-yellow-800 bg-yellow-100 p-1 rounded">
                    ⚠️ {t('publicacionDialog.noLogistics')}
                  </div>
                )}
              </div>
            </div>

            {item.precioSugeridoVenta && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-medium text-green-700 mb-0.5">💡 {t('publicacionDialog.suggested')}</p>
                    <p className="text-lg font-bold text-green-900">${item.precioSugeridoVenta.toFixed(2)}</p>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setPrecioVenta(item.precioSugeridoVenta?.toString() || "")}
                    className="text-[10px] text-green-700 border-green-300 hover:bg-green-100 h-7 px-2 flex-shrink-0"
                  >
                    {t('publicacionDialog.useSuggested')}
                  </Button>
                </div>
                <p className="text-[9px] text-green-700 mt-1">{t('publicacionDialog.marginInfo')}</p>
              </div>
            )}

            <div>
              <Label htmlFor="precioVenta" className="text-[11px] font-semibold mb-1 block text-gray-700">
                {t('publicacionDialog.salePriceB2C')}
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">$</span>
                <Input
                  id="precioVenta" type="number" step="0.01" min="0"
                  value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)}
                  className="pl-7 h-9 text-sm font-semibold border-2 focus:border-primary w-full"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2 rounded-lg border ${margin < 0 ? 'bg-red-50 border-red-300' : margin < 10 ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'}`}>
                <p className="text-[9px] font-medium text-gray-600 mb-0.5">{t('publicacionDialog.marginLabel')}</p>
                <p className={`text-base font-bold leading-tight ${margin < 0 ? 'text-red-700' : margin < 10 ? 'text-yellow-700' : 'text-green-700'}`}>
                  {margin.toFixed(1)}%
                </p>
              </div>
              <div className={`p-2 rounded-lg border ${gananciaUnitaria < 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                <p className="text-[9px] font-medium text-gray-600 mb-0.5">{t('publicacionDialog.profit')}</p>
                <p className={`text-base font-bold leading-tight ${gananciaUnitaria < 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {gananciaUnitaria >= 0 ? '+' : ''}${Math.abs(gananciaUnitaria).toFixed(2)}
                </p>
              </div>
            </div>

            {gananciaUnitaria < 0 && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-1.5">
                <p className="text-[10px] text-red-800 font-medium leading-tight">
                  ⚠️ {t('publicacionDialog.lossPerUnit', { amount: Math.abs(gananciaUnitaria).toFixed(2) })}
                </p>
              </div>
            )}

            <MarginAlert precioVenta={precioNumerico} precioCosto={item.precioCosto} />
          </div>

          <div className="border-t pt-2">
            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg gap-2">
              <div className="flex-1 min-w-0">
                <Label htmlFor="isActive" className="font-semibold text-[11px]">{t('publicacionDialog.publishToggle')}</Label>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {isActive ? `✓ ${t('publicacionDialog.visible')}` : `○ ${t('publicacionDialog.hiddenStatus')}`}
                </p>
              </div>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-1.5 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-9 text-xs">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-9 text-xs">
            {isSaving ? t('publicacionDialog.saving') : t('publicacionDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
