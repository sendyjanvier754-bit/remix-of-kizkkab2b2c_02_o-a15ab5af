import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Package } from "lucide-react";
import { SellerCatalogItem } from "@/hooks/useSellerCatalog";
import { useTranslation } from "react-i18next";

interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SellerCatalogItem | null;
  onSave: (itemId: string, newStock: number, reason?: string) => Promise<boolean>;
}

export function StockAdjustDialog({ 
  open, 
  onOpenChange, 
  item, 
  onSave 
}: StockAdjustDialogProps) {
  const { t } = useTranslation();
  const [newStock, setNewStock] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setNewStock(item.stock.toString());
      setReason("");
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    
    const stock = parseInt(newStock, 10);
    if (isNaN(stock) || stock < 0) {
      return;
    }

    setIsSaving(true);
    const success = await onSave(item.id, stock, reason || undefined);
    setIsSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  if (!item) return null;

  const stockNumerico = parseInt(newStock, 10) || 0;
  const stockDiff = stockNumerico - item.stock;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('stockAdjust.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-4 p-3 bg-muted rounded-lg">
            {item.images[0] && (
              <img 
                src={item.images[0]} 
                alt={item.nombre}
                className="w-16 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{item.nombre}</h4>
              <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{t('stockAdjust.currentStock')}:</strong> {item.stock} {t('stockAdjust.units')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newStock">{t('stockAdjust.newStock')}</Label>
            <Input
              id="newStock"
              type="number"
              min="0"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="0"
            />
            {stockDiff !== 0 && (
              <p className={`text-sm ${stockDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stockDiff > 0 ? '+' : ''}{stockDiff} {t('stockAdjust.units')}
              </p>
            )}
          </div>

          {stockDiff < 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('stockAdjust.reduceWarning', { count: Math.abs(stockDiff) })}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">{t('stockAdjust.reason')}</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('stockAdjust.reasonPlaceholder')}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('stockAdjust.saving') : t('stockAdjust.confirmAdjust')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
