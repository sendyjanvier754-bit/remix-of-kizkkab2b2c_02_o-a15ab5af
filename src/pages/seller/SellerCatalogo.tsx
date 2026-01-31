import { useState } from 'react';
import { useSellerCatalog, SellerCatalogItem } from '@/hooks/useSellerCatalog';
import { SellerLayout } from '@/components/seller/SellerLayout';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
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
} from 'lucide-react';

const SellerCatalogo = () => {
  const {
    items,
    isLoading,
    updatePrecioVenta,
    toggleActive,
    updateStock,
    getMargin,
    getStats,
    refetch,
  } = useSellerCatalog();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<SellerCatalogItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const stats = getStats();

  const filteredItems = items.filter(item =>
    item.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
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
          {items.length === 0 ? (
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
            /* Products Table */
            <Card className="bg-card border-border">
              <div className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Producto</TableHead>
                      <TableHead className="text-muted-foreground text-right">Costo Base</TableHead>
                      <TableHead className="text-muted-foreground text-right">Precio B2B*</TableHead>
                      <TableHead className="text-muted-foreground text-right">Margen</TableHead>
                      <TableHead className="text-muted-foreground text-center">Stock</TableHead>
                      <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                      <TableHead className="text-muted-foreground text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredItems.map((item) => {
                    const margin = getMargin(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              {item.images[0] ? (
                                <img
                                  src={item.images[0]}
                                  alt={item.nombre}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium line-clamp-1">{item.nombre}</p>
                              <p className="text-sm text-muted-foreground">{item.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">
                            ${item.precioCosto.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-green-600">
                            ${item.precioVenta.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={margin >= 30 ? 'default' : margin >= 15 ? 'secondary' : 'destructive'}
                          >
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={item.stock > 0 ? 'outline' : 'destructive'}>
                            {item.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={item.isActive}
                            onCheckedChange={() => toggleActive(item.id)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(item)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </div>
              <div className="p-3 bg-muted/50 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  * Los precios B2B se calculan dinámicamente según los rangos de margen configurados en el módulo de Configuración de Precios.
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
      </div>
    </SellerLayout>
  );
};

export default SellerCatalogo;
