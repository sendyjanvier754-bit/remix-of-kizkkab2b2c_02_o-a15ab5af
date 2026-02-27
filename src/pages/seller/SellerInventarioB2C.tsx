import { useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSellerCatalog, SellerCatalogItem } from "@/hooks/useSellerCatalog";
import { InventarioStats } from "@/components/seller/inventory/InventarioStats";
import { InventarioTable } from "@/components/seller/inventory/InventarioTable";
import { PublicacionDialog } from "@/components/seller/inventory/PublicacionDialog";
import { StockAdjustDialog } from "@/components/seller/inventory/StockAdjustDialog";
import { SellerBulkPriceDialog } from "@/components/seller/inventory/SellerBulkPriceDialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package, AlertCircle, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
export default function SellerInventarioB2C() {
  const { user, isLoading: authLoading } = useAuth();
  const { 
    items, 
    isLoading, 
    storeId,
    storeSlug,
    updatePrecioVenta, 
    toggleActive, 
    updateStock, 
    getMargin, 
    getStats,
    refetch 
  } = useSellerCatalog();

  const [selectedItem, setSelectedItem] = useState<SellerCatalogItem | null>(null);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [isBulkPriceOpen, setIsBulkPriceOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const stats = getStats();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleEditPrice = (item: SellerCatalogItem) => {
    setSelectedItem(item);
    setIsPriceDialogOpen(true);
  };

  const handleAdjustStock = (item: SellerCatalogItem) => {
    setSelectedItem(item);
    setIsStockDialogOpen(true);
  };

  const handleSavePrice = async (itemId: string, precioVenta: number, isActive: boolean) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return false;

    // Update price
    const priceSuccess = await updatePrecioVenta(itemId, precioVenta);
    if (!priceSuccess) return false;

    // Update active status if changed
    if (item.isActive !== isActive) {
      await toggleActive(itemId);
    }

    return true;
  };

  const handleSaveStock = async (itemId: string, newStock: number, reason?: string) => {
    return await updateStock(itemId, newStock, reason);
  };

  if (authLoading || isLoading) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

  return (
    <SellerLayout>
      <div className="p-6 space-y-6">
        {/* No Store Alert */}
        {!storeId && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Tu tienda se está configurando. Si el problema persiste, 
              <a href="/seller/onboarding" className="underline font-semibold ml-1">
                completa tu perfil de tienda aquí
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Store ID Info Card */}
        {storeSlug && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">ID de tu Tienda</p>
                <p className="text-sm font-mono text-indigo-900 mt-1 break-all">{storeSlug}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(storeSlug);
                  // Optional: Show a toast here if you have access to toast
                }}
                className="px-3 py-2 text-sm border border-indigo-300 rounded hover:bg-indigo-100 transition-colors flex-shrink-0 ml-4"
              >
                Copiar
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <InventarioStats 
          {...stats}
          actions={
            <>
              {items.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setIsBulkPriceOpen(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Actualizar Precios
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                size="icon"
                className="rounded-full"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </>
          }
        />

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="text-center py-12 bg-muted/50 rounded-lg">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin productos en inventario</h3>
            <p className="text-sm text-muted-foreground">
              Visita el <a href="/seller/adquisicion-lotes" className="underline font-semibold">Catálogo B2B</a> para comprar productos.
            </p>
          </div>
        ) : (
          /* Inventory Table */
          <InventarioTable
            items={items}
            getMargin={getMargin}
            onEditPrice={handleEditPrice}
            onAdjustStock={handleAdjustStock}
            onToggleActive={toggleActive}
          />
        )}

        {/* Dialogs */}
        <PublicacionDialog
          open={isPriceDialogOpen}
          onOpenChange={setIsPriceDialogOpen}
          item={selectedItem}
          onSave={handleSavePrice}
        />

        <StockAdjustDialog
          open={isStockDialogOpen}
          onOpenChange={setIsStockDialogOpen}
          item={selectedItem}
          onSave={handleSaveStock}
        />

        <SellerBulkPriceDialog
          open={isBulkPriceOpen}
          onOpenChange={setIsBulkPriceOpen}
          items={items}
          onSuccess={refetch}
        />
      </div>
    </SellerLayout>
  );
}
