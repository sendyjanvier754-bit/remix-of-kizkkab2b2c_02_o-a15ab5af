import React, { useState, useEffect } from 'react';
import { useSellerCatalog, SellerCatalogItem, ProductoConVariantes } from '@/hooks/useSellerCatalog';
import { SellerLayout } from '@/components/seller/SellerLayout';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { B2BCatalogImportDialog } from '@/components/seller/B2BCatalogImportDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Package,
  DollarSign,
  TrendingUp,
  Edit2,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  Download,
  ChevronDown,
  ChevronRight,
  Truck,
} from 'lucide-react';

const SellerCatalogo = () => {
  const {
    items,
    isLoading,
    storeId,
    updatePrecioVenta,
    toggleActive,
    updateStock,
    getMargin,
    groupByProduct,
    getStats,
    refetch,
  } = useSellerCatalog(true); // showAll=true para mostrar catálogo completo

  const [searchQuery, setSearchQuery] = useState('');
  const [productosAgrupados, setProductosAgrupados] = useState<ProductoConVariantes[]>([]);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<SellerCatalogItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const stats = getStats();
  const existingSkus = items.map(item => item.sku);

  // Agrupar productos al cargar
  useEffect(() => {
    const agrupar = async () => {
      const agrupados = await groupByProduct();
      setProductosAgrupados(agrupados);
    };
    agrupar();
  }, [items, groupByProduct]);

  const toggleExpanded = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const filteredProductos = productosAgrupados.filter(p =>
    p.nombreProducto.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.variantes.some(v => v.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleEditClick = (item: SellerCatalogItem) => {
    setEditingItem(item);
    setEditPrice(item.precioVenta.toString());
    setEditStock(item.stock.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    setIsUpdating(true);
    const newPrice = parseFloat(editPrice);
    const newStock = parseInt(editStock, 10);

    let success = true;

    if (!isNaN(newPrice) && newPrice !== editingItem.precioVenta) {
      success = await updatePrecioVenta(editingItem.id, newPrice);
    }

    if (success && !isNaN(newStock) && newStock !== editingItem.stock) {
      success = await updateStock(editingItem.id, newStock);
    }

    setIsUpdating(false);
    if (success) {
      setEditingItem(null);
      await refetch();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <SellerLayout>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container mx-auto px-4 pb-8">
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </main>
          <Footer />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-4 pb-8">
          {/* Stats Cards - Réplica exacta de SellerPedidosPage */}
          <div className="p-6 space-y-6">
            <div className="bg-card border border-border rounded-lg md:mt-14">
              <div className="p-3">
                <div className="border-b pb-2 mb-3 flex items-center justify-between">
                  <h1 className="text-lg font-bold text-foreground">Mi Catálogo</h1>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setIsImportDialogOpen(true)}
                      variant="default"
                      size="icon"
                      className="rounded-full"
                      style={{ backgroundColor: '#071d7f' }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 w-full">
                  <Card className="bg-card border-border">
                    <div className="p-1.5 text-center">
                      <Package className="h-3 w-3 text-primary mx-auto mb-0.5" />
                      <div className="text-base md:text-lg font-bold text-foreground">{stats.totalProducts}</div>
                      <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Productos</p>
                    </div>
                  </Card>
                  
                  <Card className="bg-green-50 border-green-200">
                    <div className="p-1.5 text-center">
                      <DollarSign className="h-3 w-3 text-green-500 mx-auto mb-0.5" />
                      <div className="text-base md:text-lg font-bold text-green-500">${stats.totalValue.toFixed(2)}</div>
                      <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Valor</p>
                    </div>
                  </Card>

                  <Card className="bg-blue-50 border-blue-200">
                    <div className="p-1.5 text-center">
                      <Package className="h-3 w-3 text-blue-500 mx-auto mb-0.5" />
                      <div className="text-base md:text-lg font-bold text-blue-500">{stats.totalStock}</div>
                      <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Stock</p>
                    </div>
                  </Card>

                  <Card className="bg-amber-50 border-amber-200">
                    <div className="p-1.5 text-center">
                      <TrendingUp className="h-3 w-3 text-amber-500 mx-auto mb-0.5" />
                      <div className="text-base md:text-lg font-bold text-amber-500">{stats.avgMargin.toFixed(1)}%</div>
                      <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Margen</p>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          {/* Search Card - Réplica exacta de SellerPedidosPage */}
          <Card className="bg-card border-border">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o SKU..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Empty State */}
          {productosAgrupados.length === 0 ? (
            <Card className="bg-card border-border p-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin productos en tu catálogo</h3>
              <p className="text-muted-foreground mb-4">
                Compra lotes mayoristas en el catálogo B2B para agregar productos a tu tienda.
              </p>
              <Button asChild>
                <a href="/seller/adquisicion-lotes">Ir al Catálogo B2B</a>
              </Button>
            </Card>
          ) : (
            /* Grouped Products Table */
            <Card className="bg-card border-border">
              <div className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-muted-foreground">Producto</TableHead>
                      <TableHead className="text-muted-foreground text-right">Precio Compra</TableHead>
                      <TableHead className="text-muted-foreground text-right">Logística</TableHead>
                      <TableHead className="text-muted-foreground text-right">Precio Venta</TableHead>
                      <TableHead className="text-muted-foreground text-right">Margen</TableHead>
                      <TableHead className="text-muted-foreground text-center">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProductos.map((producto, idx) => {
                      // Calcular promedios para la fila padre
                      const costosPromedio = producto.variantes.reduce((sum, v) => sum + v.precioCosto, 0) / producto.variantes.length || 0;
                      const preciosPromedio = producto.variantes.reduce((sum, v) => sum + v.precioVenta, 0) / producto.variantes.length || 0;
                      const logisticaPromedio = producto.variantes.reduce((sum, v) => sum + v.costoLogistica, 0) / producto.variantes.length || 0;
                      const margenPromedio = costosPromedio > 0 ? ((preciosPromedio - costosPromedio - logisticaPromedio) / costosPromedio) * 100 : 0;
                      return (
                        <React.Fragment key={`product-${idx}-${producto.productId}`}>
                          {/* Parent Product Row */}
                          <TableRow
                            className="hover:bg-muted/40 cursor-pointer border-border font-medium"
                            onClick={() => toggleExpanded(producto.productId)}
                          >
                            <TableCell className="w-8">
                              {expandedProducts.has(producto.productId) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {producto.imagenPrincipal && (
                                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                    <img
                                      src={producto.imagenPrincipal}
                                      alt={producto.nombreProducto}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{producto.nombreProducto}</p>
                                  {producto.marcaProducto && (
                                    <p className="text-xs text-muted-foreground">{producto.marcaProducto}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-sm">
                                <p className="text-muted-foreground">${costosPromedio.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground/60">promedio</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                ${logisticaPromedio.toFixed(2)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <p className="font-semibold text-green-600">${preciosPromedio.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground/60">promedio</p>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={margenPromedio >= 30 ? 'default' : margenPromedio >= 15 ? 'secondary' : 'destructive'}
                              >
                                {margenPromedio.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={producto.totalStock > 0 ? "outline" : "secondary"} className={producto.totalStock === 0 ? "bg-amber-50 text-amber-700 border-amber-200" : ""}>
                                {producto.totalStock}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Variants Rows */}
                          {expandedProducts.has(producto.productId) && (
                            <>
                              {/* Seller's Purchased/Imported Variants */}
                              {producto.variantes.map((variant) => {
                                const margin = getMargin(variant);
                                return (
                                  <TableRow key={`variant-${variant.id}`} className="bg-muted/30 border-border">
                                    <TableCell></TableCell>
                                    <TableCell>
                                      <div className="pl-4">
                                        <p className="text-sm font-medium">{variant.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{variant.sku}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <p className="text-sm text-muted-foreground">${variant.precioCosto.toFixed(2)}</p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                        ${variant.costoLogistica.toFixed(2)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <p className="font-semibold text-green-600">${variant.precioVenta.toFixed(2)}</p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge
                                        variant={margin >= 30 ? 'default' : margin >= 15 ? 'secondary' : 'destructive'}
                                      >
                                        {margin.toFixed(1)}%
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {variant.stock > 0 ? (
                                        <Badge variant="outline">{variant.stock}</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                                          sin stock
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}

                              {/* Available Variants from Admin Catalog */}
                              {producto.variantes_disponibles.length > 0 && (
                                <>
                                  <TableRow className="bg-green-50/30 border-border border-t-2 border-t-green-200">
                                    <TableCell colSpan={7}>
                                      <p className="text-xs font-semibold text-green-700 pl-4">Variantes disponibles en Catálogo Admin</p>
                                    </TableCell>
                                  </TableRow>
                                  {producto.variantes_disponibles.map((available) => (
                                    <TableRow key={`available-${available.id}`} className="bg-green-50/10 border-border">
                                      <TableCell></TableCell>
                                      <TableCell>
                                        <div className="pl-4">
                                          <p className="text-sm text-green-700">{available.nombre}</p>
                                          <p className="text-xs text-muted-foreground">{available.sku}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell colSpan={5} className="text-right text-xs text-muted-foreground">
                                        No importado • Peso: {available.weight_kg}kg
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="p-3 bg-muted/50 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  Tabla de catálogo completo mostrando precio de compra, logística pagada y precio de venta sugerido. Haz clic en un producto para expandir y ver detalle de variantes.
                </p>
              </div>
            </Card>
          )}
        </main>

        <Footer />

        {/* Edit Dialog */}
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Producto</DialogTitle>
            </DialogHeader>

            {editingItem && (
              <div className="space-y-3 py-3">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-background">
                    {editingItem.images[0] ? (
                      <img
                        src={editingItem.images[0]}
                        alt={editingItem.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{editingItem.nombre}</p>
                    <p className="text-sm text-muted-foreground">{editingItem.sku}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="edit-price">Precio de Venta (USD)</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Costo: ${editingItem.precioCosto.toFixed(2)} | Margen sugerido: 30%
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="edit-stock">Stock Disponible</Label>
                    <Input
                      id="edit-stock"
                      type="number"
                      min="0"
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <B2BCatalogImportDialog
          isOpen={isImportDialogOpen}
          onClose={() => setIsImportDialogOpen(false)}
          onImportComplete={refetch}
          existingSkus={existingSkus}
          storeId={storeId}
        />
      </div>
    </SellerLayout>
  );
};

export default SellerCatalogo;
