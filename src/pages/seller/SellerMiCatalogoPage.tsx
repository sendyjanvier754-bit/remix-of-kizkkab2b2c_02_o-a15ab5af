import { useState, useEffect } from 'react';
import { SellerLayout } from '@/components/seller/SellerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSellerCatalog, ProductoConVariantes, SellerCatalogItem } from '@/hooks/useSellerCatalog';
import { useAuth } from '@/hooks/useAuth';
import { B2BCatalogImportDialog } from '@/components/seller/B2BCatalogImportDialog';
import { MiCatalogStatsCards } from '@/components/seller/catalog/MiCatalogStatsCards';
import { MiCatalogTable } from '@/components/seller/catalog/MiCatalogTable';
import { EditProductDialog } from '@/components/seller/catalog/EditProductDialog';
import { Search, RefreshCw, Download, AlertCircle, Loader2, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SellerMiCatalogoPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    items,
    isLoading,
    storeId,
    isShippingConfigured,
    updateStock,
    getStats,
    groupByProduct,
    refetch,
  } = useSellerCatalog(true); // showAll = true para mostrar todo el catálogo

  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGrouping, setIsGrouping] = useState(false);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SellerCatalogItem | null>(null);

  // Grouped products
  const [productosAgrupados, setProductosAgrupados] = useState<ProductoConVariantes[]>([]);

  // Get stats
  const stats = getStats();

  // Group products when items change (DO NOT include groupByProduct in dependencies - causes infinite loop)
  useEffect(() => {
    if (items.length === 0) {
      setProductosAgrupados([]);
      return;
    }

    const agrupar = async () => {
      setIsGrouping(true);
      try {
        const grouped = await groupByProduct();
        
        // Filter by search term
        let filtered = grouped;
        if (searchTerm.trim()) {
          const searchLower = searchTerm.toLowerCase();
          filtered = grouped.filter(prod =>
            prod.nombreProducto.toLowerCase().includes(searchLower) ||
            prod.variantes.some(v => 
              v.nombre.toLowerCase().includes(searchLower) ||
              v.sku.toLowerCase().includes(searchLower)
            )
          );
        }
        
        setProductosAgrupados(filtered);
      } catch (error) {
        console.error('Error grouping products:', error);
        setProductosAgrupados([]);
      } finally {
        setIsGrouping(false);
      }
    };

    agrupar();
  }, [items, searchTerm]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEditProduct = (item: SellerCatalogItem) => {
    setSelectedItem(item);
    setEditDialogOpen(true);
  };

  const handleSaveProduct = async (itemId: string, precio: number, stock: number) => {
    // Update stock
    const success = await updateStock(itemId, stock);
    if (!success) return false;

    // Note: Price update is disabled in useSellerCatalog hook (returns false)
    // This is by design - prices are calculated automatically via pricing engine
    return true;
  };

  const handleImportSuccess = async () => {
    setImportDialogOpen(false);
    await refetch();
  };

  const handleImportVariants = (productId: string, availableVariants: ProductoConVariantes['variantes_disponibles']) => {
    // This would open the import dialog with the product pre-selected
    // For now, just open the general import dialog
    setImportDialogOpen(true);
  };

  if (authLoading) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-muted-foreground text-sm">Autenticando...</p>
          </div>
        </div>
      </SellerLayout>
    );
  }

  if (!user) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Por favor inicia sesión</p>
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
              Tu tienda se está configurando. Si el problema persiste, 
              <a href="/seller/onboarding" className="underline font-semibold ml-1">
                completa tu configuración
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
        {/* Header with Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mi Catálogo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona tu catálogo e inventario de vendedor
            </p>
          </div>
        </div>

        {/* Shipping market notification banner */}
        {!isShippingConfigured && (
          <Alert className="border-amber-300 bg-amber-50">
            <Globe className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <span className="text-amber-800">
                <strong>Configura tu mercado de envío</strong> para ver los costos de logística
                en la columna &quot;Logística&quot;. Sin esta configuración los costos no se calcularán.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                onClick={() => navigate('/seller/cuenta?tab=informacion&section=mercado')}
              >
                Configurar ahora
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <MiCatalogStatsCards stats={stats} />

        {/* Controls Card */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre de producto o SKU..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Actualizar datos"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>

              {/* Import Button */}
              <Button
                onClick={() => setImportDialogOpen(true)}
                className="gap-2"
                disabled={!storeId || isRefreshing}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Importar</span>
                <span className="sm:hidden">Importar</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {isLoading 
                ? 'Cargando catálogo...' 
                : isGrouping 
                ? 'Organizando productos...' 
                : `Productos (${productosAgrupados.length})`
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || isGrouping ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isLoading ? 'Cargando tu catálogo...' : 'Organizando productos...'}
                  </p>
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
      </div>

      {/* Edit Product Dialog */}
      <EditProductDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={selectedItem}
        onSave={handleSaveProduct}
      />

      {/* Import Catalog Dialog */}
      <B2BCatalogImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        storeId={storeId || ''}
        existingSkus={items.map(i => i.sku)}
        onSuccess={handleImportSuccess}
      />
    </SellerLayout>
  );
}
