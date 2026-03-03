import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategories } from '@/hooks/useCategories';
import { InventarioB2CItem, InventarioB2CVariante } from '@/hooks/useInventarioB2C';
import { ShoppingCart, Package, DollarSign, Truck, Clock } from 'lucide-react';

interface PublishToB2CModalProps {
  open: boolean;
  onClose: () => void;
  item: InventarioB2CItem;
  onPublish: (data: PublishData) => Promise<void>;
}

export interface VariantePublish {
  variant_id: string;
  sku: string;
  color: string;
  size: string;
  stock_total: number; // Stock total disponible
  stock_a_publicar: number; // Cantidad que se publicará
  precio_original: number;
  precio_venta: number;
}

export interface PublishData {
  productId: string;
  orderId: string; // order_id del inventario B2B
  nombre: string;
  descripcion: string;
  categoryId: string | null;
  images: string[];
  variantes: VariantePublish[];
  delivery_time_days: number;
  shipping_cost: number;
  is_preorder: boolean; // true si availability_status = 'pending'
}

interface VarianteSelection {
  precio: number;
  cantidad: number;
}

export function PublishToB2CModal({
  open,
  onClose,
  item,
  onPublish,
}: PublishToB2CModalProps) {
  const { data: categories, isLoading: loadingCategories } = useCategories(true);
  
  // Estado del formulario
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [deliveryTimeDays, setDeliveryTimeDays] = useState('7');
  const [shippingCost, setShippingCost] = useState('5.00');
  const [selectedVariantes, setSelectedVariantes] = useState<Map<string, VarianteSelection>>(new Map());
  const [isPublishing, setIsPublishing] = useState(false);

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (open && item) {
      setNombre(item.producto_nombre);
      setDescripcion(item.descripcion_corta || '');
      
      // Pre-seleccionar la categoría original si existe
      if (item.categoria_id) {
        setCategoryId(item.categoria_id);
      } else {
        setCategoryId('');
      }
      
      // Pre-seleccionar todas las variantes con precio sugerido (20% margen) y stock completo
      const initialSelection = new Map<string, VarianteSelection>();
      item.variantes.forEach(v => {
        const precioSugerido = v.precio_original * 1.2;
        initialSelection.set(v.variant_id, {
          precio: parseFloat(precioSugerido.toFixed(2)),
          cantidad: v.stock, // Por defecto todo el stock
        });
      });
      setSelectedVariantes(initialSelection);
      
      // Configuración por defecto
      setDeliveryTimeDays('7');
      setShippingCost('5.00');
    }
  }, [open, item]);

  const toggleVariante = (variantId: string, stockTotal: number) => {
    const newSelection = new Map(selectedVariantes);
    if (newSelection.has(variantId)) {
      newSelection.delete(variantId);
    } else {
      const variante = item.variantes.find(v => v.variant_id === variantId);
      if (variante) {
        const precioSugerido = variante.precio_original * 1.2;
        newSelection.set(variantId, {
          precio: parseFloat(precioSugerido.toFixed(2)),
          cantidad: stockTotal, // Por defecto todo el stock
        });
      }
    }
    setSelectedVariantes(newSelection);
  };

  const updateVariantePrice = (variantId: string, precio: number) => {
    const newSelection = new Map(selectedVariantes);
    const current = newSelection.get(variantId);
    if (current) {
      newSelection.set(variantId, { ...current, precio });
      setSelectedVariantes(newSelection);
    }
  };

  const updateVarianteCantidad = (variantId: string, cantidad: number, maxStock: number) => {
    const newSelection = new Map(selectedVariantes);
    const current = newSelection.get(variantId);
    if (current) {
      // Limitar al stock máximo disponible
      const cantidadValida = Math.min(Math.max(1, cantidad), maxStock);
      newSelection.set(variantId, { ...current, cantidad: cantidadValida });
      setSelectedVariantes(newSelection);
    }
  };

  const handleSubmit = async () => {
    if (selectedVariantes.size === 0) {
      alert('Selecciona al menos una variante para publicar');
      return;
    }

    if (!categoryId) {
      alert('Por favor selecciona una categoría');
      return;
    }

    // Validar que todos los precios y cantidades sean válidos
    for (const [variantId, selection] of selectedVariantes) {
      if (selection.precio <= 0) {
        alert('Todos los precios deben ser mayores a $0');
        return;
      }
      if (selection.cantidad <= 0) {
        alert('Todas las cantidades deben ser mayores a 0');
        return;
      }
    }

    setIsPublishing(true);

    try {
      // Construir array de variantes a publicar
      const variantesToPublish: VariantePublish[] = item.variantes
        .filter(v => selectedVariantes.has(v.variant_id))
        .map(v => {
          const selection = selectedVariantes.get(v.variant_id)!;
          return {
            variant_id: v.variant_id,
            sku: v.sku,
            color: v.color,
            size: v.size,
            stock_total: v.stock,
            stock_a_publicar: selection.cantidad,
            precio_original: v.precio_original,
            precio_venta: selection.precio,
          };
        });

      const publishData: PublishData = {
        productId: item.product_id,
        orderId: item.order_id,
        nombre,
        descripcion,
        categoryId,
        images: item.galeria_imagenes || [item.imagen_principal],
        variantes: variantesToPublish,
        delivery_time_days: parseInt(deliveryTimeDays) || 7,
        shipping_cost: parseFloat(shippingCost) || 5.0,
        is_preorder: item.availability_status === 'pending'
      };

      await onPublish(publishData);
      onClose();
    } catch (error) {
      console.error('Error al publicar:', error);
      alert('Hubo un error al publicar el producto');
    } finally {
      setIsPublishing(false);
    }
  };

  // Categorías raíz (sin parent_id)
  const rootCategories = categories?.filter(c => !c.parent_id) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Publicar en Marketplace B2C
          </DialogTitle>
          <DialogDescription>
            Configura los detalles para publicar este producto en tu catálogo público
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Información del producto */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-4">
              <img
                src={item.imagen_principal}
                alt={item.producto_nombre}
                className="w-20 h-20 rounded-md object-cover"
              />
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold">{item.producto_nombre}</h4>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">
                    <Package className="h-3 w-3 mr-1" />
                    {item.variantes.length} variante{item.variantes.length > 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline">
                    Stock Total: {item.total_stock}
                  </Badge>
                  {item.availability_status === 'pending' ? (
                    <Badge className="bg-amber-500">
                      ⏳ Preventa (En tránsito)
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500">
                      ✅ Disponible ahora
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pedido: {item.order_number}
                </p>
              </div>
            </div>
          </div>

          {/* Nombre del producto */}
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del Producto *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre visible en el marketplace"
            />
            <p className="text-xs text-muted-foreground">
              Puedes personalizar el nombre para tu catálogo
            </p>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe las características del producto..."
              rows={4}
            />
          </div>

          {/* Selección de variantes con precios */}
          <div className="space-y-3">
            <Label>Variantes a Publicar</Label>
            <div className="space-y-3">
              {item.variantes.map((variante) => {
                const isSelected = selectedVariantes.has(variante.variant_id);
                const selection = selectedVariantes.get(variante.variant_id);
                const precioVenta = selection?.precio || variante.precio_original * 1.2;
                const cantidadAPublicar = selection?.cantidad || variante.stock;
                
                return (
                  <div key={variante.variant_id} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleVariante(variante.variant_id, variante.stock)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex gap-2 flex-wrap">
                            {variante.color && (
                              <Badge variant="outline" className="text-xs">
                                {variante.color}
                              </Badge>
                            )}
                            {variante.size && (
                              <Badge variant="outline" className="text-xs">
                                Talla: {variante.size}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            SKU: {variante.sku}
                          </p>
                          <p className="text-xs font-medium">
                            Stock total: {variante.stock} unidades
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tu costo: ${variante.precio_original.toFixed(2)}/unidad
                          </p>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Cantidad a publicar */}
                          <div className="space-y-1">
                            <Label htmlFor={`cantidad-${variante.variant_id}`} className="text-xs">
                              Cantidad a Publicar
                            </Label>
                            <Input
                              id={`cantidad-${variante.variant_id}`}
                              type="number"
                              min="1"
                              max={variante.stock}
                              value={cantidadAPublicar}
                              onChange={(e) => updateVarianteCantidad(
                                variante.variant_id, 
                                parseInt(e.target.value) || 1,
                                variante.stock
                              )}
                              className="h-8 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              Máx: {variante.stock}
                            </p>
                          </div>
                          
                          {/* Precio de venta */}
                          <div className="space-y-1">
                            <Label htmlFor={`precio-${variante.variant_id}`} className="text-xs">
                              Precio Venta (USD)
                            </Label>
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              <Input
                                id={`precio-${variante.variant_id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={precioVenta}
                                onChange={(e) => updateVariantePrice(variante.variant_id, parseFloat(e.target.value))}
                                className="pl-7 h-8 text-sm"
                              />
                            </div>
                            {precioVenta > variante.precio_original && (
                              <p className="text-xs text-green-600 font-medium">
                                +${(precioVenta - variante.precio_original).toFixed(2)}/u 
                                ({(((precioVenta - variante.precio_original) / variante.precio_original) * 100).toFixed(0)}%)
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {isSelected && cantidadAPublicar < variante.stock && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-2">
                          <p className="text-xs text-blue-800">
                            📦 Publicarás {cantidadAPublicar} de {variante.stock} unidades. 
                            Las {variante.stock - cantidadAPublicar} restantes quedarán en inventario privado.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedVariantes.size} de {item.variantes.length} variante{item.variantes.length > 1 ? 's' : ''} seleccionada{selectedVariantes.size !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Configuración de envío */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tiempo de Entrega (días)
              </Label>
              <Input
                id="delivery-time"
                type="number"
                min="1"
                value={deliveryTimeDays}
                onChange={(e) => setDeliveryTimeDays(e.target.value)}
                placeholder="7"
              />
              <p className="text-xs text-muted-foreground">
                Días estimados para entregar al comprador
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="shipping-cost" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Costo de Envío (USD)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="shipping-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  className="pl-9"
                  placeholder="5.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Costo fijo por pedido
              </p>
            </div>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoría *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {loadingCategories ? (
                  <SelectItem value="loading" disabled>
                    Cargando categorías...
                  </SelectItem>
                ) : (
                  <>
                    {rootCategories.map((category) => {
                      // Categorías hijas
                      const children = categories?.filter(c => c.parent_id === category.id) || [];
                      
                      return (
                        <div key={category.id}>
                          <SelectItem value={category.id}>
                            {category.name}
                          </SelectItem>
                          {children.map((child) => (
                            <SelectItem key={child.id} value={child.id} className="pl-6">
                              &nbsp;&nbsp;└─ {child.name}
                            </SelectItem>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
              </SelectContent>
            </Select>
            {item.categoria_id && categoryId === item.categoria_id && (
              <p className="text-xs text-blue-600">
                ✓ Categoría original del producto. Puedes cambiarla si lo deseas.
              </p>
            )}
            {!item.categoria_id && (
              <p className="text-xs text-amber-600">
                ⚠️ El producto original no tiene categoría asignada. Selecciona una.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Los compradores encontrarán tu producto en esta categoría del marketplace
            </p>
          </div>

          {/* Nota sobre preventa/disponibilidad */}
          {item.availability_status === 'pending' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>⏳ Preventa:</strong> El producto se publicará como "Preventa" porque aún no ha sido entregado. 
                Cambiará automáticamente a "Disponible" cuando recibas el pedido.
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                <strong>✅ Disponible:</strong> El producto se publicará como "Disponible para envío inmediato". 
                Las ventas descontarán del stock automáticamente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPublishing}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPublishing}>
            {isPublishing ? (
              <>Publicando...</>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Publicar Producto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
