import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalog, Product, ProductFilters } from '@/hooks/useCatalog';
import { Package, AlertTriangle, TrendingDown, Search, Upload, Plus, Download, Settings, Loader2, Cpu, ExternalLink, DollarSign, RefreshCw } from 'lucide-react';
import SmartBulkImportDialog from '@/components/catalog/SmartBulkImportDialog';
import ProductFormDialog from '@/components/catalog/ProductFormDialog';
import ProductEditDialog from '@/components/catalog/ProductEditDialog';
import ProductEmbeddingsManager from '@/components/admin/ProductEmbeddingsManager';
import BulkPriceUpdateDialog from '@/components/catalog/BulkPriceUpdateDialog';
import { ProductNormalizationTool } from '@/components/admin/ProductNormalizationTool';
import ProductsWithoutWeightAlert from '@/components/admin/ProductsWithoutWeightAlert';
import { supabase } from '@/integrations/supabase/client';

const AdminCatalogo = () => {
  const { t } = useTranslation();
  const { useProducts, useCategories, useSuppliers, useCatalogKPIs } = useCatalog();
  const [filters, setFilters] = useState<ProductFilters>({ stockStatus: 'all' });
  const [searchTerm, setSearchTerm] = useState('');
  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [dynamicPrices, setDynamicPrices] = useState<Record<string, number>>({});

  const { data: products, isLoading: loadingProducts } = useProducts({ ...filters, search: searchTerm });
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: kpis, isLoading: loadingKPIs } = useCatalogKPIs();

  // Fetch dynamic prices from v_productos_con_precio_b2b
  useEffect(() => {
    const fetchDynamicPrices = async () => {
      if (!products || products.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('v_productos_con_precio_b2b')
          .select('id, precio_b2b');

        if (!error && data) {
          const priceMap = data.reduce((acc: Record<string, number>, item: { id: string; precio_b2b: number }) => {
            acc[item.id] = item.precio_b2b;
            return acc;
          }, {});
          setDynamicPrices(priceMap);
        }
      } catch (err) {
        console.error('Error fetching dynamic prices:', err);
      }
    };

    fetchDynamicPrices();
  }, [products]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const exportToCSV = () => {
    if (!products) return;
    
    const headers = ['SKU Interno', 'Nombre', 'Precio B2B', 'MOQ', 'Stock', 'Estado', 'Categoría', 'Proveedor'];
    const rows = products.map(p => [
      p.sku_interno,
      p.nombre,
      dynamicPrices[p.id] ?? 0,
      p.moq,
      p.stock_fisico,
      p.stock_status,
      p.categories?.name || '',
      p.suppliers?.name || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `catalogo_siver_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStockBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{t('adminCatalog.inStock')}</Badge>;
      case 'low_stock':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{t('adminCatalog.lowStock')}</Badge>;
      case 'out_of_stock':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{t('adminCatalog.outOfStock')}</Badge>;
      default:
        return null;
    }
  };

  return (
    <AdminLayout title={t('adminCatalog.title')} subtitle={t('adminCatalog.subtitle')}>
      <Tabs defaultValue="productos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="productos" className="gap-2">
            <Package className="h-4 w-4" />
            {t('adminCatalog.products')}
          </TabsTrigger>
          <TabsTrigger value="embeddings" className="gap-2">
            <Cpu className="h-4 w-4" />
            {t('adminCatalog.aiEmbeddings')}
          </TabsTrigger>
          <TabsTrigger value="normalization" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('adminCatalog.normalizeEAV')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="space-y-6">
        {/* Alerta de productos sin peso */}
        <ProductsWithoutWeightAlert compact maxItems={5} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="default" onClick={() => setSmartImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              {t('adminCatalog.importProducts')}
            </Button>
            <Button variant="outline" onClick={() => setBulkPriceOpen(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              {t('adminCatalog.updatePrices')}
            </Button>
            <Button variant="outline" onClick={() => setNewProductOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('adminCatalog.newEntry')}
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              {t('adminCatalog.exportCSV')}
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('adminCatalog.activeSKUs')}</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loadingKPIs ? <Loader2 className="h-5 w-5 animate-spin" /> : kpis?.totalSKUs || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Stock Total</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loadingKPIs ? <Loader2 className="h-5 w-5 animate-spin" /> : kpis?.totalStock?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alertas Bajo MOQ</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {loadingKPIs ? <Loader2 className="h-5 w-5 animate-spin" /> : kpis?.lowMoqAlerts || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Agotados</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {loadingKPIs ? <Loader2 className="h-5 w-5 animate-spin" /> : kpis?.outOfStock || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU o nombre..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) => setFilters(f => ({ ...f, category: value }))}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Categorías</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.supplier || 'all'}
                onValueChange={(value) => setFilters(f => ({ ...f, supplier: value }))}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Proveedores</SelectItem>
                  {suppliers?.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.stockStatus || 'all'}
                onValueChange={(value) => setFilters(f => ({ ...f, stockStatus: value as ProductFilters['stockStatus'] }))}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Estado Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="in_stock">En Stock</SelectItem>
                  <SelectItem value="low_stock">Bajo MOQ</SelectItem>
                  <SelectItem value="out_of_stock">Agotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground">SKU Interno</TableHead>
                    <TableHead className="text-muted-foreground">Producto</TableHead>
                    <TableHead className="text-muted-foreground text-right">Precio B2B</TableHead>
                    <TableHead className="text-muted-foreground text-center">MOQ</TableHead>
                    <TableHead className="text-muted-foreground text-center">Stock</TableHead>
                    <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                    <TableHead className="text-muted-foreground">Proveedor</TableHead>
                    <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProducts ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : products?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No hay productos en el catálogo
                      </TableCell>
                    </TableRow>
                  ) : (
                    products?.map((product) => (
                      <TableRow key={product.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-mono text-sm text-foreground">{product.sku_interno}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.imagen_principal && (
                              <img
                                src={product.imagen_principal}
                                alt={product.nombre}
                                className="h-10 w-10 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium text-foreground">{product.nombre}</p>
                              <p className="text-xs text-muted-foreground">{product.categories?.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          ${(dynamicPrices[product.id] ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center text-foreground">{product.moq}</TableCell>
                        <TableCell className="text-center text-foreground">{product.stock_fisico}</TableCell>
                        <TableCell className="text-center">{getStockBadge(product.stock_status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{product.suppliers?.name || '-'}</span>
                            {product.url_origen && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => window.open(product.url_origen, '_blank')}
                                title="Ver en proveedor"
                              >
                                <ExternalLink className="h-3 w-3 text-primary" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditProductId(product.id)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="embeddings">
          <ProductEmbeddingsManager />
        </TabsContent>

        <TabsContent value="normalization">
          <ProductNormalizationTool onComplete={() => {
            // Refetch products after normalization
          }} />
        </TabsContent>
      </Tabs>
      {/* Dialogs */}
      <SmartBulkImportDialog open={smartImportOpen} onOpenChange={setSmartImportOpen} />
      <ProductFormDialog open={newProductOpen} onOpenChange={setNewProductOpen} />
      <BulkPriceUpdateDialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen} />
      {editProductId && (
        <ProductEditDialog
          productId={editProductId}
          open={!!editProductId}
          onOpenChange={(open) => !open && setEditProductId(null)}
        />
      )}
    </AdminLayout>
  );
};

export default AdminCatalogo;
