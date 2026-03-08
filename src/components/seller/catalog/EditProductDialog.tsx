import { useState } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SellerCatalogItem } from '@/hooks/useSellerCatalog';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SellerCatalogItem | null;
  onSave: (itemId: string, precio: number, stock: number) => Promise<boolean>;
}

export function EditProductDialog({ open, onOpenChange, item, onSave }: EditProductDialogProps) {
  const { t } = useTranslation();
  const [precio, setPrecio] = useState(item?.precioVenta.toString() || '');
  const [stock, setStock] = useState(item?.stock.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when item changes
  React.useEffect(() => {
    if (item) {
      setPrecio(item.precioVenta.toString());
      setStock(item.stock.toString());
    }
  }, [item, open]);

  const handleSave = async () => {
    if (!item) return;

    const precioNum = parseFloat(precio);
    const stockNum = parseInt(stock, 10);

    if (isNaN(precioNum) || precioNum < 0) {
      toast.error(t('editProductDialog.invalidPrice'));
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      toast.error(t('editProductDialog.invalidStock'));
      return;
    }

    setIsSaving(true);
    const success = await onSave(item.id, precioNum, stockNum);
    setIsSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  if (!item) return null;

  const precioNum = parseFloat(precio) || 0;
  const margen = item.precioCosto > 0 
    ? ((precioNum - item.precioCosto) / item.precioCosto * 100)
    : 0;

  const margenSugerido = item.precioCosto * 1.3; // 30% margin

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('editProductDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('editProductDialog.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* Product Info Header */}
        <div className="bg-muted/50 p-4 rounded-lg border border-border mb-6">
          <div className="flex gap-4">
            {item.images && item.images[0] && (
              <img
                src={item.images[0]}
                alt={item.nombre}
                className="h-12 w-12 rounded object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{item.nombre}</h3>
              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Precio de Venta */}
          <div className="space-y-2">
            <Label htmlFor="precio">{t('editProductDialog.salePrice')}</Label>
            <div className="flex items-center">
              <span className="text-lg font-bold mr-2">$</span>
              <Input
                id="precio"
                type="number"
                step="0.01"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="flex-1"
                placeholder="0.00"
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1 mt-2 p-2 bg-muted/30 rounded">
              <p>💰 Costo: ${item.precioCosto.toFixed(2)}</p>
              <p>📊 Margen actual: {margen.toFixed(1)}%</p>
              <p className="text-amber-600 font-medium">💡 Margen sugerido (30%): ${margenSugerido.toFixed(2)}</p>
            </div>
          </div>

          {/* Stock Disponible */}
          <div className="space-y-2">
            <Label htmlFor="stock">Stock Disponible</Label>
            <Input
              id="stock"
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              className="text-lg"
            />
            <p className="text-xs text-muted-foreground">
              Unidades disponibles en tu inventario
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
