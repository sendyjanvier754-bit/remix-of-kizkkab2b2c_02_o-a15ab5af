import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/seller/SellerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSellerCatalog, ProductoConVariantes, SellerCatalogItem, SellerCatalogSourceType } from '@/hooks/useSellerCatalog';
import { useAuth } from '@/hooks/useAuth';
import { B2BCatalogImportDialog } from '@/components/seller/B2BCatalogImportDialog';
import { MiCatalogStatsCards } from '@/components/seller/catalog/MiCatalogStatsCards';
import { MiCatalogTable } from '@/components/seller/catalog/MiCatalogTable';
import { EditProductDialog } from '@/components/seller/catalog/EditProductDialog';
import { Search, RefreshCw, Download, AlertCircle, Loader2, Globe, Package, ShoppingBag, DollarSign } from 'lucide-react';
import { BulkPriceUpdateDialog } from '@/components/seller/catalog/BulkPriceUpdateDialog';
import { useNavigate } from 'react-router-dom';

export default function SellerMiCatalogoPage() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'imported' | 'inventory'>('imported');
  
  // Two separate hooks for each tab
  const catalogImported = useSellerCatalog(true, 'imported');
  const catalogInventory = useSellerCatalog(true, 'inventory');

  // Use the active tab's data
  const {
    productos,
    isLoading,
    storeId,
    isShippingConfigured,
    updateStock,
    updatePrecioVenta,
    getStats,
    refetch,
  } = activeTab === 'imported' ? catalogImported : catalogInventory;

  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkPriceDialogOpen, setBulkPriceDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SellerCatalogItem | null>(null);

  // Get stats
  const stats = getStats();

  // Filter products by search (no async, no N+1)
  const productosAgrupados = useMemo(() => {
    if (!searchTerm.trim()) return productos;
    const searchLower = searchTerm.toLowerCase();
    return productos.filter(prod =>
      prod.nombreProducto.toLowerCase().includes(searchLower) ||
      prod.variantes.some(v =>
        v.nombre.toLowerCase().includes(searchLower) ||
        v.sku.toLowerCase().includes(searchLower)
      )
    );
  }, [productos, searchTerm]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { 
      await Promise.all([catalogImported.refetch(), catalogInventory.refetch()]);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const handleEditProduct = (item: SellerCatalogItem) => {
    setSelectedItem(item);
    setEditDialogOpen(true);
  };

  const handleSaveProduct = async (itemId: string, precio: number, stock: number) => {
    const [stockOk, precioOk] = await Promise.all([
      updateStock(itemId, stock),
      updatePrecioVenta(itemId, precio),
    ]);
    return stockOk && precioOk;
  };

  const handleImportSuccess = async () => {
    setImportDialogOpen(false);
    await Promise.all([catalogImported.refetch(), catalogInventory.refetch()]);
  };

  const handleImportVariants = (productId: string, availableVariants: ProductoConVariantes['variantes_disponibles']) => {
    setImportDialogOpen(true);
  };

  if (authLoading) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-muted-foreground text-sm">{t('sellerCatalog.authenticating')}</p>
          </div>
        </div>
      </SellerLayout>
    );
  }

  if (!user) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t('sellerCatalog.pleaseLogin')}</p>
        </div>
      </SellerLayout>
    );
  }

  if (!storeId) {
    return (
      <SellerLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('sellerCatalog.storeSetup')} 
              <a href="/seller/onboarding" className="underline font-semibold ml-1">
                {t('sellerCatalog.completeSetup')}
              </a>
            </AlertDescription>
          </Alert>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('sellerCatalog.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('sellerCatalog.subtitle')}
            </p>
          </div>
        </div>

        {!isShippingConfigured && (
          <Alert className="border-amber-300 bg-amber-50">
            <Globe className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <span className="text-amber-800">
                <strong>{t('sellerCatalog.shipTitle')}</strong> {t('sellerCatalog.shipBody')}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                onClick={() => navigate('/seller/cuenta?tab=informacion&section=mercado')}
              >
                {t('sellerCatalog.configureNow')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <MiCatalogStatsCards stats={stats} />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'imported' | 'inventory')} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="imported" className="gap-2">
              <Download className="h-4 w-4" />
              {t('sellerCatalog.tabImported')}
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="h-4 w-4" />
              {t('sellerCatalog.tabInventory')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="imported" className="space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('sellerCatalog.search')}
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                   <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} title={t('sellerCatalog.refresh')}>
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button variant="secondary" onClick={() => setBulkPriceDialogOpen(true)} className="gap-2" disabled={!storeId || productos.length === 0}>
                    <DollarSign className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('sellerCatalog.bulkPrices')}</span>
                  </Button>
                  <Button onClick={() => setImportDialogOpen(true)} className="gap-2" disabled={!storeId || isRefreshing}>
                    <Download className="h-4 w-4" />
                    <span>{t('sellerCatalog.import')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {catalogImported.isLoading ? t('sellerCatalog.loadingCatalog') : t('sellerCatalog.importedCount', { count: productosAgrupados.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {catalogImported.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t('sellerCatalog.loadingImported')}</p>
                    </div>
                  </div>
                ) : (
                  <MiCatalogTable
                    productos={productosAgrupados}
                    isLoading={false}
                    onEditProduct={handleEditProduct}
                    onImportVariants={handleImportVariants}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('sellerCatalog.search')}
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} title={t('sellerCatalog.refresh')}>
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button variant="secondary" onClick={() => setBulkPriceDialogOpen(true)} className="gap-2" disabled={!storeId || productos.length === 0}>
                    <DollarSign className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('sellerCatalog.bulkPrices')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {catalogInventory.isLoading ? t('sellerCatalog.loadingInventory') : t('sellerCatalog.inventoryCount', { count: productosAgrupados.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {catalogInventory.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t('sellerCatalog.loadingInventoryProducts')}</p>
                    </div>
                  </div>
                ) : productosAgrupados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t('sellerCatalog.noInventory')}</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {t('sellerCatalog.noInventoryHint')}
                    </p>
                  </div>
                ) : (
                  <MiCatalogTable
                    productos={productosAgrupados}
                    isLoading={false}
                    onEditProduct={handleEditProduct}
                    onImportVariants={handleImportVariants}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <EditProductDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={selectedItem}
        onSave={handleSaveProduct}
      />

      <B2BCatalogImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        storeId={storeId || ''}
        existingSkus={productos.flatMap(p => p.variantes.map(v => v.sku))}
        onSuccess={handleImportSuccess}
      />
      <BulkPriceUpdateDialog
        open={bulkPriceDialogOpen}
        onOpenChange={setBulkPriceDialogOpen}
        productos={productos}
        storeId={storeId}
        onSuccess={handleRefresh}
      />
    </SellerLayout>
  );
}
