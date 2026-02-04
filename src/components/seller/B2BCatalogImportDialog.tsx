import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Package, Loader2, Plus, Check, ImageOff } from 'lucide-react';

interface B2BProduct {
  id: string;
  sku_interno: string;
  nombre: string;
  descripcion_corta: string | null;
  precio_b2b: number;
  precio_sugerido_venta: number | null;
  imagen_principal: string | null;
  stock?: number;
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
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch B2B products
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('v_productos_con_precio_b2b')
        .select('id, sku_interno, nombre, descripcion_corta, precio_b2b, precio_sugerido_venta, imagen_principal')
        .eq('is_active', true)
        .order('nombre');

      if (search) {
        query = query.or(`nombre.ilike.%${search}%,sku_interno.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setProducts(data || []);
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
      
      // Prepare catalog items - using precio_b2b (with market margins) and calculate_suggested_pvp()
      const catalogItems = await Promise.all(
        selectedProductsList.map(async (product) => {
          // Get suggested PVP from database function
          let suggestedPvp = product.precio_sugerido_venta;
          
          if (!suggestedPvp) {
            const { data: pvpData } = await supabase.rpc('calculate_suggested_pvp', {
              p_product_id: product.id
            });
            suggestedPvp = pvpData || product.precio_b2b * 4; // Fallback to 4x markup
          }
          
          return {
            seller_store_id: storeId,
            source_product_id: product.id,
            source_order_id: null, // No order - direct import for marketing
            sku: product.sku_interno,
            nombre: product.nombre,
            descripcion: product.descripcion_corta,
            precio_costo: product.precio_b2b, // ← Precio con márgenes de mercado
            precio_venta: suggestedPvp, // ← PVP calculado o sugerido
            stock: 0, // No physical stock - marketing only
            images: product.imagen_principal ? JSON.stringify([product.imagen_principal]) : JSON.stringify([]),
            is_active: true,
            metadata: { import_type: 'b2b_catalog_direct', marketing_only: true },
          };
        })
      );

      const { error } = await supabase
        .from('seller_catalog')
        .insert(catalogItems);

      if (error) throw error;

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
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      alreadyImported 
                        ? 'bg-muted/50 cursor-not-allowed opacity-60' 
                        : isSelected 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted/50 cursor-pointer'
                    }`}
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
                    </div>

                    {/* Price & Status */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-sm">${product.precio_b2b.toFixed(2)}</p>
                      {alreadyImported && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Importado
                        </Badge>
                      )}
                    </div>
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
