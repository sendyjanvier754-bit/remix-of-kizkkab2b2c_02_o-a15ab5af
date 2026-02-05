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
import { useCatalog, Product, Category, Supplier } from '@/hooks/useCatalog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface BulkPriceUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SelectionMode = 'manual' | 'category' | 'supplier';
type AdjustmentType = 'percentage' | 'fixed';
type AdjustmentOperation = 'increase' | 'decrease';

export default function BulkPriceUpdateDialog({ open, onOpenChange }: BulkPriceUpdateDialogProps) {
  const queryClient = useQueryClient();
  const { useProducts, useCategories, useSuppliers } = useCatalog();
  
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('category');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('percentage');
  const [adjustmentOperation, setAdjustmentOperation] = useState<AdjustmentOperation>('increase');
  const [adjustmentValue, setAdjustmentValue] = useState<string>('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Calculate affected products based on selection
  const affectedProducts = useMemo(() => {
    if (!products) return [];
    
    switch (selectionMode) {
      case 'manual':
        return products.filter(p => selectedProductIds.includes(p.id));
      case 'category':
        if (selectedCategories.length === 0) return [];
        return products.filter(p => p.categoria_id && selectedCategories.includes(p.categoria_id));
      case 'supplier':
        if (selectedSuppliers.length === 0) return [];
        return products.filter(p => p.proveedor_id && selectedSuppliers.includes(p.proveedor_id));
      default:
        return [];
    }
  }, [products, selectionMode, selectedProductIds, selectedCategories, selectedSuppliers]);

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

  // Preview data
  const previewData = useMemo(() => {
    if (affectedProducts.length === 0 || !adjustmentValue) return null;
    
    const totalBefore = affectedProducts.reduce((sum, p) => sum + p.precio_mayorista_base, 0);
    const totalAfter = affectedProducts.reduce((sum, p) => sum + calculateNewPrice(p.precio_mayorista_base), 0);
    
    return {
      productCount: affectedProducts.length,
      totalBefore,
      totalAfter,
      difference: totalAfter - totalBefore,
    };
  }, [affectedProducts, adjustmentValue, adjustmentType, adjustmentOperation]);

  const handleUpdatePrices = async () => {
    if (affectedProducts.length === 0 || !adjustmentValue) return;
    
    setIsUpdating(true);
    
    try {
      // Build the update query based on selection mode
      const value = parseFloat(adjustmentValue);
      
      // Calculate factor or fixed amount
      let updateExpression: string;
      if (adjustmentType === 'percentage') {
        const factor = adjustmentOperation === 'increase' ? (1 + value / 100) : (1 - value / 100);
        updateExpression = `precio_mayorista_base * ${factor}`;
      } else {
        updateExpression = adjustmentOperation === 'increase' 
          ? `precio_mayorista_base + ${value}` 
          : `GREATEST(0, precio_mayorista_base - ${value})`;
      }
      
      // Build the update for all affected products
      const productIds = affectedProducts.map(p => p.id);
      
      // Update each product's price
      const updates = affectedProducts.map(p => ({
        id: p.id,
        precio_mayorista_base: Math.round(calculateNewPrice(p.precio_mayorista_base) * 100) / 100,
      }));
      
      // Batch update
      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update({ precio_mayorista_base: update.precio_mayorista_base })
          .eq('id', update.id);
        
        if (error) throw error;
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-kpis'] });
      
      toast.success(`${affectedProducts.length} productos actualizados exitosamente`);
      handleClose();
    } catch (error) {
      console.error('Error updating prices:', error);
      toast.error('Error al actualizar precios');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setSelectionMode('category');
    setSelectedCategories([]);
    setSelectedSuppliers([]);
    setSelectedProductIds([]);
    setAdjustmentType('percentage');
    setAdjustmentOperation('increase');
    setAdjustmentValue('');
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const getSelectionLabel = () => {
    switch (selectionMode) {
      case 'category':
        return selectedCategories.length > 0 
          ? categories?.filter(c => selectedCategories.includes(c.id)).map(c => c.name).join(', ')
          : 'Ninguna categoría seleccionada';
      case 'supplier':
        return selectedSuppliers.length > 0
          ? suppliers?.filter(s => selectedSuppliers.includes(s.id)).map(s => s.name).join(', ')
          : 'Ningún proveedor seleccionado';
      case 'manual':
        return `${selectedProductIds.length} productos seleccionados`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Actualización Masiva de Precios B2B
          </DialogTitle>
          <DialogDescription>
            Ajusta los precios mayoristas de múltiples productos a la vez
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
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="category" id="category" />
                  <Label htmlFor="category">Por Categoría</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="supplier" id="supplier" />
                  <Label htmlFor="supplier">Por Proveedor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual">Selección Manual</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Category Selection */}
            {selectionMode === 'category' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Seleccionar Categorías</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {categories?.map(category => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`cat-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <Label htmlFor={`cat-${category.id}`} className="text-sm cursor-pointer">
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supplier Selection */}
            {selectionMode === 'supplier' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Seleccionar Proveedores</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {suppliers?.map(supplier => (
                    <div key={supplier.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`sup-${supplier.id}`}
                        checked={selectedSuppliers.includes(supplier.id)}
                        onCheckedChange={() => toggleSupplier(supplier.id)}
                      />
                      <Label htmlFor={`sup-${supplier.id}`} className="text-sm cursor-pointer">
                        {supplier.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Product Selection */}
            {selectionMode === 'manual' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Seleccionar Productos</Label>
                <div className="max-h-48 overflow-y-auto p-2 border rounded-md space-y-1">
                  {loadingProducts ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    products?.map(product => (
                      <div key={product.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`prod-${product.id}`}
                          checked={selectedProductIds.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <Label htmlFor={`prod-${product.id}`} className="text-sm cursor-pointer flex-1">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{product.sku_interno}</span>
                          {product.nombre}
                        </Label>
                        <span className="text-sm font-medium">${product.precio_mayorista_base.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Selection Summary */}
            <div className="flex items-center gap-2 text-sm">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Selección:</span>
              <Badge variant="secondary">{affectedProducts.length} productos</Badge>
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
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Vista Previa:</strong> {previewData.productCount} productos serán actualizados.
                  <br />
                  Total actual: <strong>${previewData.totalBefore.toFixed(2)}</strong> → 
                  Nuevo total: <strong>${previewData.totalAfter.toFixed(2)}</strong>
                  <span className={previewData.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {' '}({previewData.difference >= 0 ? '+' : ''}{previewData.difference.toFixed(2)})
                  </span>
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
                Vas a actualizar <strong>{affectedProducts.length}</strong> productos.
                <br />
                Ajuste: <strong>{adjustmentOperation === 'increase' ? '+' : '-'}{adjustmentValue}{adjustmentType === 'percentage' ? '%' : '$'}</strong>
              </AlertDescription>
            </Alert>

            {/* Sample of affected products */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Muestra de productos afectados:</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {affectedProducts.slice(0, 10).map(product => (
                  <div key={product.id} className="flex justify-between items-center py-1 text-sm">
                    <span className="truncate flex-1">{product.nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">${product.precio_mayorista_base.toFixed(2)}</span>
                      <span>→</span>
                      <span className="font-medium">${calculateNewPrice(product.precio_mayorista_base).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {affectedProducts.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    ... y {affectedProducts.length - 10} productos más
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
              disabled={affectedProducts.length === 0 || !adjustmentValue}
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
