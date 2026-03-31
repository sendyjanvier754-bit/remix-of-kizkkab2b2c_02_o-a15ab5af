import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, DollarSign, Percent, Filter } from 'lucide-react';
import { SellerCatalogItem } from '@/hooks/useSellerCatalog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface SellerBulkPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SellerCatalogItem[];
  onSuccess: () => void;
}

type SelectionMode = 'all' | 'manual';
type AdjustmentType = 'percentage' | 'fixed';
type AdjustmentOperation = 'increase' | 'decrease';

export function SellerBulkPriceDialog({ open, onOpenChange, items, onSuccess }: SellerBulkPriceDialogProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('percentage');
  const [adjustmentOperation, setAdjustmentOperation] = useState<AdjustmentOperation>('increase');
  const [adjustmentValue, setAdjustmentValue] = useState<string>('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Calculate affected items based on selection
  const affectedItems = useMemo(() => {
    if (selectionMode === 'all') return items;
    return items.filter(item => selectedItemIds.includes(item.id));
  }, [items, selectionMode, selectedItemIds]);

  // Calculate new prices preview
  const calculateNewPrice = (currentPrice: number) => {
    const value = parseFloat(adjustmentValue) || 0;
    
    if (adjustmentType === 'percentage') {
      const factor = adjustmentOperation === 'increase' ? (1 + value / 100) : (1 - value / 100);
      return Math.max(0, currentPrice * factor);
    } else {
      return adjustmentOperation === 'increase' 
        ? currentPrice + value 
        : Math.max(0, currentPrice - value);
    }
  };

  // Check for margin warnings
  const getMarginWarnings = useMemo(() => {
    if (!adjustmentValue) return [];
    
    return affectedItems
      .map(item => {
        const newPrice = calculateNewPrice(item.precioVenta);
        const margin = ((newPrice - item.precioCosto) / item.precioCosto) * 100;
        return { item, newPrice, margin };
      })
      .filter(({ newPrice, item }) => newPrice < item.precioCosto);
  }, [affectedItems, adjustmentValue, adjustmentType, adjustmentOperation]);

  // Preview data
  const previewData = useMemo(() => {
    if (affectedItems.length === 0 || !adjustmentValue) return null;
    
    const totalBefore = affectedItems.reduce((sum, item) => sum + item.precioVenta, 0);
    const totalAfter = affectedItems.reduce((sum, item) => sum + calculateNewPrice(item.precioVenta), 0);
    
    return {
      itemCount: affectedItems.length,
      totalBefore,
      totalAfter,
      difference: totalAfter - totalBefore,
      hasWarnings: getMarginWarnings.length > 0,
    };
  }, [affectedItems, adjustmentValue, getMarginWarnings]);

  const handleUpdatePrices = async () => {
    if (affectedItems.length === 0 || !adjustmentValue) return;
    
    setIsUpdating(true);
    
    try {
      // Update each item's price
      for (const item of affectedItems) {
        const newPrice = Math.round(calculateNewPrice(item.precioVenta) * 100) / 100;
        
        const { error } = await supabase
          .from('seller_catalog')
          .update({ precio_venta: newPrice })
          .eq('id', item.id);
        
        if (error) throw error;
      }
      
      toast.success(`${affectedItems.length} productos actualizados exitosamente`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error updating prices:', error);
      toast.error(t('toasts.errorUpdatingPrices'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setSelectionMode('all');
    setSelectedItemIds([]);
    setAdjustmentType('percentage');
    setAdjustmentOperation('increase');
    setAdjustmentValue('');
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAll = () => {
    setSelectedItemIds(items.map(i => i.id));
  };

  const selectNone = () => {
    setSelectedItemIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Actualización Masiva de Precios B2C
          </DialogTitle>
          <DialogDescription>
            Ajusta los precios de venta de múltiples productos a la vez
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-6">
            {/* Selection Mode */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Modo de Selección</Label>
              <RadioGroup 
                value={selectionMode} 
                onValueChange={(v) => setSelectionMode(v as SelectionMode)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">Todos los Productos ({items.length})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual">Selección Manual</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Manual Selection */}
            {selectionMode === 'manual' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Seleccionar Productos</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      Todos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={selectNone}>
                      Ninguno
                    </Button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto p-2 border rounded-md space-y-1">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center space-x-2 py-1">
                      <Checkbox 
                        id={`item-${item.id}`}
                        checked={selectedItemIds.includes(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <Label htmlFor={`item-${item.id}`} className="text-sm cursor-pointer flex-1">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{item.sku}</span>
                        {item.nombre}
                      </Label>
                      <span className="text-sm font-medium">${item.precioVenta.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selection Summary */}
            <div className="flex items-center gap-2 text-sm">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Selección:</span>
              <Badge variant="secondary">{affectedItems.length} productos</Badge>
            </div>

            {/* Adjustment Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Ajuste</Label>
                <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Porcentaje
                      </div>
                    </SelectItem>
                    <SelectItem value="fixed">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Valor Fijo
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Operación</Label>
                <Select value={adjustmentOperation} onValueChange={(v) => setAdjustmentOperation(v as AdjustmentOperation)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Aumentar</SelectItem>
                    <SelectItem value="decrease">Disminuir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Adjustment Value */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Valor del Ajuste {adjustmentType === 'percentage' ? '(%)' : '($)'}
              </Label>
              <Input
                type="number"
                min="0"
                step={adjustmentType === 'percentage' ? '1' : '0.01'}
                placeholder={adjustmentType === 'percentage' ? 'Ej: 10' : 'Ej: 0.50'}
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
              />
            </div>

            {/* Preview */}
            {previewData && (
              <Alert className={previewData.hasWarnings ? 'border-yellow-500 bg-yellow-500/10' : ''}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Vista Previa:</strong> {previewData.itemCount} productos serán actualizados.
                  <br />
                  Total actual: <strong>${previewData.totalBefore.toFixed(2)}</strong> → 
                  Nuevo total: <strong>${previewData.totalAfter.toFixed(2)}</strong>
                  <span className={previewData.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {' '}({previewData.difference >= 0 ? '+' : ''}{previewData.difference.toFixed(2)})
                  </span>
                  {previewData.hasWarnings && (
                    <div className="mt-2 text-yellow-600">
                      ⚠️ {getMarginWarnings.length} productos quedarán con precio por debajo del costo
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          /* Confirmation View */
          <div className="space-y-4">
            <Alert className="border-yellow-500 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-600">
                <strong>Confirmar actualización masiva</strong>
                <br />
                Vas a actualizar <strong>{affectedItems.length}</strong> productos.
                <br />
                Ajuste: <strong>{adjustmentOperation === 'increase' ? '+' : '-'}{adjustmentValue}{adjustmentType === 'percentage' ? '%' : '$'}</strong>
              </AlertDescription>
            </Alert>

            {/* Margin Warnings */}
            {getMarginWarnings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>¡Atención!</strong> Los siguientes productos tendrán precio menor al costo:
                  <ul className="mt-2 space-y-1">
                    {getMarginWarnings.slice(0, 5).map(({ item, newPrice }) => (
                      <li key={item.id} className="text-sm">
                        {item.nombre}: ${item.precioCosto.toFixed(2)} (costo) → ${newPrice.toFixed(2)} (venta)
                      </li>
                    ))}
                  </ul>
                  {getMarginWarnings.length > 5 && (
                    <p className="mt-1 text-sm">... y {getMarginWarnings.length - 5} más</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Sample of affected items */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Muestra de productos afectados:</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {affectedItems.slice(0, 10).map(item => (
                  <div key={item.id} className="flex justify-between items-center py-1 text-sm">
                    <span className="truncate flex-1">{item.nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">${item.precioVenta.toFixed(2)}</span>
                      <span>→</span>
                      <span className="font-medium">${calculateNewPrice(item.precioVenta).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {affectedItems.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    ... y {affectedItems.length - 10} productos más
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          
          {!showConfirmation ? (
            <Button 
              onClick={() => setShowConfirmation(true)}
              disabled={affectedItems.length === 0 || !adjustmentValue}
            >
              Continuar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowConfirmation(false)}>
                Volver
              </Button>
              <Button 
                onClick={handleUpdatePrices}
                disabled={isUpdating}
                className="bg-primary"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  'Confirmar Actualización'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
