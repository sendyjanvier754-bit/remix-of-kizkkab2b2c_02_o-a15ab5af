import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Package, Loader2, Plus, Check, ImageOff, DollarSign } from 'lucide-react';

interface B2BProduct {
  id: string;
  sku_interno: string;
  nombre: string;
  descripcion_corta: string | null;
  precio_b2b: number;
  precio_sugerido_venta: number | null;
  imagen_principal: string | null;
  stock?: number;
  suggested_pvp?: number | null; // From v_business_panel_data
}

interface B2BCatalogImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  existingSkus: string[];
  onSuccess: () => void;
}

export function B2BCatalogImportDialog({
  open,
  onOpenChange,
  storeId,
  existingSkus,
  onSuccess,
}: B2BCatalogImportDialogProps) {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch B2B products with suggested PVP from v_business_panel_data
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch products from v_business_panel_data to get suggested_pvp_per_unit
      let query = supabase
        .from('v_business_panel_data')
        .select('product_id, item_name, sku, cost_per_unit, suggested_pvp_per_unit')
        .eq('is_active', true)
        .eq('item_type', 'product')
        .order('item_name');

      if (search) {
        query = query.or(`item_name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      const { data: bpData, error: bpError } = await query.limit(50);
      if (bpError) throw bpError;

      // Map to B2BProduct interface and fetch additional details
      const productIds = (bpData || []).map(p => p.product_id);
      
      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from('v_productos_con_precio_b2b')
          .select('id, sku_interno, nombre, descripcion_corta, precio_b2b, precio_sugerido_venta, imagen_principal')
          .in('id', productIds);

        if (productsError) throw productsError;

        // Merge data
        const mergedProducts = (productsData || []).map(p => {
          const bp = bpData?.find(b => b.product_id === p.id);
          return {
            ...p,
            suggested_pvp: bp?.suggested_pvp_per_unit || null,
          };
        });

        setProducts(mergedProducts);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      fetchProducts();
    } else {
      setSelectedProducts(new Set());
      setCustomPrices({});
      setSearch('');
    }
  }, [open, fetchProducts]);

  // Debounce search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, fetchProducts]);

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleImport = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    setIsImporting(true);
    try {
      const selectedProductsList = products.filter(p => selectedProducts.has(p.id));
      
      // Prepare catalog items - using custom price or suggested PVP from v_business_panel_data
      const catalogItems = selectedProductsList.map(product => {
        // Priority: custom price > suggested_pvp from v_business_panel_data > precio_sugerido_venta
        const precioVenta = customPrices[product.id] 
          || product.suggested_pvp 
          || product.precio_sugerido_venta 
          || null;

        // Skip products without a valid price
        if (!precioVenta || precioVenta <= 0) {
          toast.error(`${product.nombre}: Sin precio de venta válido. Configura tu mercado o establece un precio manualmente.`);
          return null;
        }
          
        return {
          seller_store_id: storeId,
          source_product_id: product.id,
          source_order_id: null, // No order - direct import for marketing
          sku: product.sku_interno,
          nombre: product.nombre,
          descripcion: product.descripcion_corta,
          precio_costo: product.precio_b2b,
          precio_venta: precioVenta, // Custom or suggested PVP
          stock: 0, // No physical stock - marketing only
          images: product.imagen_principal ? JSON.stringify([product.imagen_principal]) : JSON.stringify([]),
          is_active: true,
          metadata: { 
            import_type: 'b2b_catalog_direct', 
            marketing_only: true,
            price_source: customPrices[product.id] ? 'manual' : 'suggested'
          },
        };
      }).filter(Boolean); // Remove nulls

      if (catalogItems.length === 0) {
        toast.error('No hay productos válidos para importar');
        setIsImporting(false);
        return;
      }

      // Insert into seller_catalog and get the IDs back
      const { data: insertedCatalog, error: catalogError } = await supabase
        .from('seller_catalog')
        .insert(catalogItems)
        .select('id, source_product_id, sku');

      if (catalogError) throw catalogError;
      if (!insertedCatalog || insertedCatalog.length === 0) {
        throw new Error('No se pudieron insertar los productos');
      }

      // Now create default variants in seller_catalog_variants for each inserted product
      // Get product_variants for these products
      const sourceProductIds = insertedCatalog.map(c => c.source_product_id);
      const { data: productVariantsRaw, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, product_id, sku, price')
        .in('product_id', sourceProductIds);
      const productVariants = productVariantsRaw as unknown as Array<{ id: string; product_id: string; sku: string; price: number | null }>;

      if (variantsError) throw variantsError;

      // Create seller_catalog_variants entries
      const catalogVariants = [];
      for (const catalog of insertedCatalog) {
        // Get all product variants for this product
        const variants = productVariants?.filter(v => v.product_id === catalog.source_product_id) || [];
        
        if (variants.length > 0) {
          // Insert all variants
          for (const variant of variants) {
            const selectedProduct = selectedProductsList.find(p => p.id === catalog.source_product_id);
            const precioVenta = customPrices[catalog.source_product_id!] 
              || selectedProduct?.suggested_pvp 
              || selectedProduct?.precio_sugerido_venta 
              || variant.price;

            catalogVariants.push({
              seller_catalog_id: catalog.id,
              variant_id: variant.id,
              sku: variant.sku,
              precio_override: precioVenta,
              stock: 0,
              is_available: true,
              availability_status: 'available',
            });
          }
        } else {
          // No variants found - create a default one
          const selectedProduct = selectedProductsList.find(p => p.id === catalog.source_product_id);
          const precioVenta = customPrices[catalog.source_product_id!] 
            || selectedProduct?.suggested_pvp 
            || selectedProduct?.precio_sugerido_venta 
            || selectedProduct?.precio_b2b;

          catalogVariants.push({
            seller_catalog_id: catalog.id,
            variant_id: null, // No specific variant
            sku: catalog.sku,
            precio_override: precioVenta,
            stock: 0,
            is_available: true,
            availability_status: 'available',
          });
        }
      }

      // Insert all variants
      if (catalogVariants.length > 0) {
        const { error: variantsInsertError } = await supabase
          .from('seller_catalog_variants')
          .insert(catalogVariants);

        if (variantsInsertError) {
          console.error('Error inserting variants:', variantsInsertError);
          // Don't throw - products are already inserted
        }
      }

      toast.success(`${selectedProducts.size} productos importados exitosamente`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error importing products:', error);
      if (error.code === '23505') {
        toast.error('Algunos productos ya existen en tu catálogo');
      } else {
        toast.error('Error al importar productos');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const isAlreadyImported = (sku: string) => existingSkus.includes(sku);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] flex flex-col w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Importar
          </DialogTitle>
          <div className="sr-only">Selecciona productos del catálogo B2B para importar</div>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products List */}
        <ScrollArea className="flex-1 max-h-[400px] border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-2 opacity-50" />
              <p>No se encontraron productos</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {products.map((product) => {
                const alreadyImported = isAlreadyImported(product.sku_interno);
                const isSelected = selectedProducts.has(product.id);
                
                return (
                  <div
                    key={product.id}
                    className={`rounded-lg border transition-colors ${
                      alreadyImported 
                        ? 'bg-muted/50 cursor-not-allowed opacity-60' 
                        : isSelected 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted/50'
                    }`}
                  >
                    {/* Main row: Checkbox, Image, Info, Status */}
                    <div 
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      onClick={() => !alreadyImported && toggleProduct(product.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={alreadyImported}
                        onCheckedChange={() => !alreadyImported && toggleProduct(product.id)}
                      />
                      
                      {/* Image */}
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.imagen_principal ? (
                          <img
                            src={product.imagen_principal}
                            alt={product.nombre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageOff className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.nombre}</p>
                        <p className="text-xs text-muted-foreground">{product.sku_interno}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Costo: <span className="font-medium">${product.precio_b2b.toFixed(2)}</span>
                        </p>
                      </div>

                      {/* Status */}
                      <div className="text-right flex-shrink-0">
                        {alreadyImported && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Importado
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Price input (only shown when selected) */}
                    {isSelected && !alreadyImported && (
                      <div className="px-3 pb-3 pt-0 border-t" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mt-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground block mb-1">
                              Precio de Venta
                              {(product.suggested_pvp || product.precio_sugerido_venta) && (
                                <span className="ml-1 font-medium text-primary">
                                  (Sugerido: ${(product.suggested_pvp || product.precio_sugerido_venta)?.toFixed(2)})
                                </span>
                              )}
                              {!product.suggested_pvp && !product.precio_sugerido_venta && (
                                <span className="ml-1 text-orange-600 font-medium">
                                  (Sin PVP - configura tu mercado)
                                </span>
                              )}
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={
                                (product.suggested_pvp || product.precio_sugerido_venta)?.toFixed(2) || 
                                'Establecer precio...'
                              }
                              value={customPrices[product.id] || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0) {
                                  setCustomPrices(prev => ({ ...prev, [product.id]: value }));
                                } else if (e.target.value === '') {
                                  setCustomPrices(prev => {
                                    const newPrices = { ...prev };
                                    delete newPrices[product.id];
                                    return newPrices;
                                  });
                                }
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={selectedProducts.size === 0 || isImporting}
            style={{ backgroundColor: '#071d7f' }}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Importar {selectedProducts.size}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
