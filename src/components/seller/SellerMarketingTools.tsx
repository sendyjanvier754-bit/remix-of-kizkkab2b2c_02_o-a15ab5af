import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  FileText, 
  Image, 
  Download, 
  Eye, 
  Check, 
  Package,
  Loader2,
  QrCode,
  Share2,
  X,
  Trash2,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  openPDFCatalog,
  generateAndDownloadPDFCatalog, 
  downloadWhatsAppStatusImage, 
  downloadWhatsAppStatusBulk,
  type WhatsAppStatusOptions
} from '@/services/marketingGenerators';
import { useSellerCatalog } from '@/hooks/useSellerCatalog';
import { useStore } from '@/hooks/useStore';
import { useAuth } from '@/hooks/useAuth';
import { B2BCatalogImportDialog } from '@/components/seller/B2BCatalogImportDialog';
import { useMarketingAssets } from '@/hooks/useMarketingAssets';

interface CatalogProduct {
  id: string;          // sourceProductId (or item.id if no source)
  sku: string;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  images: string[];
  variantIds: string[]; // all seller_catalog row IDs in this group
  variants?: Array<{
    id: string;
    sku: string;
    color?: string;
    size?: string;
    image?: string;
  }>;
  store_slug: string;
  store_name: string;
}

export const SellerMarketingTools: React.FC = () => {
  const { user } = useAuth();
  const { items: catalogItems, storeId, refetch, deleteItems } = useSellerCatalog(true);
  const { data: store } = useStore(storeId || undefined);
  const { assets: marketingHistory, saveAsset, deleteAsset } = useMarketingAssets(storeId);
  
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [previewProduct, setPreviewProduct] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Transform catalog items to CatalogProduct format — grouped by sourceProductId
  const products: CatalogProduct[] = useMemo(() => {
    const groups = new Map<string, CatalogProduct>();

    for (const item of catalogItems) {
      const groupId = item.sourceProductId || item.id;
      // Strip variant suffix like " - Negro / 3XL" for display name
      const baseName = item.nombre.includes(' - ')
        ? item.nombre.substring(0, item.nombre.lastIndexOf(' - ')).trim()
        : item.nombre;

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          sku: item.sku,
          nombre: baseName,
          descripcion: item.descripcion,
          precio_venta: item.precioVenta,
          images: [...item.images],
          variantIds: [item.id],
          variants: [],
          store_slug: store?.slug || '',
          store_name: store?.name || '',
        });
      } else {
        const group = groups.get(groupId)!;
        // Merge images (deduplicate)
        for (const img of item.images) {
          if (img && !group.images.includes(img)) group.images.push(img);
        }
        group.variantIds.push(item.id);
        // Use lowest price across variants
        if (item.precioVenta < group.precio_venta) group.precio_venta = item.precioVenta;
      }
    }

    return Array.from(groups.values());
  }, [catalogItems, store]);

  const selectedProductsData = useMemo(() => {
    return products.filter(p => selectedProducts.has(p.id));
  }, [products, selectedProducts]);

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedProducts(new Set(products.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Handle product deletion with confirmation
  const handleDeleteProducts = async () => {
    if (selectedProducts.size === 0) return;

    setIsDeleting(true);
    try {
      // Get all variant IDs for the selected products
      const variantIdsToDelete = products
        .filter(p => selectedProducts.has(p.id))
        .flatMap(p => p.variantIds);

      const { success, error } = await deleteItems(variantIdsToDelete);

      if (success) {
        toast.success(`${selectedProducts.size} producto${selectedProducts.size !== 1 ? 's' : ''} eliminado${selectedProducts.size !== 1 ? 's' : ''}`);
        clearSelection();
        setDeleteDialogOpen(false);
      } else {
        toast.error(error || 'Error al eliminar productos');
      }
    } catch (error) {
      console.error('Error deleting products:', error);
      toast.error('Error al eliminar productos');
    } finally {
      setIsDeleting(false);
    }
  };

  // Generate PDF Catalog — download real PDF AND save to DB
  const handleGeneratePDF = async () => {
    if (selectedProductsData.length === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    setIsGeneratingPDF(true);
    toast.loading('Generando PDF, espera un momento...', { id: 'pdf-generation' });
    
    try {
      const pdfOptions = {
        products: selectedProductsData,
        storeId: storeId || '',
        storeName: store?.name || 'Mi Tienda',
        storeLogo: store?.logo || undefined,
        storeSlug: store?.slug || '',
        primaryColor: '#8B5CF6',
        showQR: true,
        trackingEnabled: true,
      };

      // Generate PDF file and download it
      const { pdfBlob, htmlContent } = await generateAndDownloadPDFCatalog(pdfOptions);
      
      toast.success('Catálogo PDF generado y descargado', { id: 'pdf-generation' });

      // Save to DB in background (non-blocking) with the actual PDF file
      if (user && pdfBlob && htmlContent) {
        const title = `Catálogo PDF · ${selectedProductsData.length} producto${selectedProductsData.length !== 1 ? 's' : ''}`;
        saveAsset({
          sellerId: user.id,
          storeId: storeId || '',
          type: 'pdf_catalog',
          title,
          htmlContent,
          pdfBlob,  // Now uploading the actual PDF!
          productCount: selectedProductsData.length,
          metadata: {
            store_name: store?.name,
            products: selectedProductsData.map(p => ({ id: p.id, nombre: p.nombre, precio: p.precio_venta })),
          },
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar catálogo', { id: 'pdf-generation' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Download single WhatsApp status
  const handleDownloadSingleStatus = async (product: CatalogProduct) => {
    try {
      await downloadWhatsAppStatusImage({
        product,
        storeId: storeId || '',
        storeName: store?.name || 'Mi Tienda',
        storeLogo: store?.logo || undefined,
        storeSlug: store?.slug || '',
      });
      toast.success('Imagen descargada');
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Error al descargar imagen');
    }
  };

  // Download bulk WhatsApp status images
  const handleDownloadBulkStatus = async () => {
    if (selectedProductsData.length === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    setIsGeneratingImages(true);
    setDownloadProgress({ current: 0, total: selectedProductsData.length });
    
    try {
      await downloadWhatsAppStatusBulk(
        selectedProductsData,
        {
          storeId: storeId || '',
          storeName: store?.name || 'Mi Tienda',
          storeLogo: store?.logo || undefined,
          storeSlug: store?.slug || '',
        },
        (current, total) => setDownloadProgress({ current, total })
      );
      toast.success(`${selectedProductsData.length} imágenes descargadas`);
    } catch (error) {
      console.error('Error downloading images:', error);
      toast.error('Error al descargar imágenes');
    } finally {
      setIsGeneratingImages(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Tu tienda se está configurando...</p>
          <Button asChild variant="outline">
            <a href="/seller/onboarding">Completar configuración</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Marketing
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* PDF Catalog */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Catálogo PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Button 
              onClick={handleGeneratePDF} 
              disabled={isGeneratingPDF || selectedProducts.size === 0}
              className="w-full"
              size="sm"
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Status */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Image className="h-4 w-4 text-green-500" />
              Catálogo PNG
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {isGeneratingImages && downloadProgress.total > 0 && (
              <div className="space-y-1">
                <Progress 
                  value={(downloadProgress.current / downloadProgress.total) * 100} 
                />
                <p className="text-xs text-muted-foreground text-center">
                  {downloadProgress.current}/{downloadProgress.total}
                </p>
              </div>
            )}
            
            <Button 
              onClick={handleDownloadBulkStatus} 
              disabled={isGeneratingImages || selectedProducts.size === 0}
              className="w-full"
              size="sm"
              variant="outline"
            >
              {isGeneratingImages ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1" />
                  {selectedProducts.size > 0 ? `${selectedProducts.size} Imágenes` : 'Imágenes'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Products Grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-end pb-3 pt-3">
          {products.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                title="Seleccionar todo"
                onClick={selectedProducts.size === products.length ? clearSelection : selectAll}
                className="flex items-center justify-center h-7 w-7 rounded border border-input bg-background hover:bg-accent transition-colors"
              >
                {selectedProducts.size === products.length
                  ? <Check className="h-4 w-4 text-primary" />
                  : <Check className="h-4 w-4 text-muted-foreground" />}
              </button>
              {selectedProducts.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedProducts.size}
                </Badge>
              )}
              {selectedProducts.size > 0 && (
                <button
                  title="Limpiar selección"
                  onClick={clearSelection}
                  className="flex items-center justify-center h-7 w-7 rounded border border-input bg-background hover:bg-accent transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {selectedProducts.size > 0 && (
                <button
                  title="Eliminar seleccionados"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="flex items-center justify-center h-7 w-7 rounded border border-destructive bg-background hover:bg-destructive hover:text-destructive-foreground transition-colors text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-4">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No tienes productos en tu catálogo</p>
              <p className="text-sm max-w-md mx-auto">
                Importa productos directamente desde el catálogo B2B para generar materiales de marketing.
                ¡No necesitas comprar primero!
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="default"
                  style={{ backgroundColor: '#071d7f' }}
                  onClick={() => setImportDialogOpen(true)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Importar desde B2B
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {products.map(product => {
                const isSelected = selectedProducts.has(product.id);
                return (
                  <div 
                    key={product.id}
                    className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelected 
                        ? 'ring-2 ring-primary border-primary' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    {/* Selection checkbox */}
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox 
                        checked={isSelected}
                        className="bg-white/80 backdrop-blur-sm"
                      />
                    </div>
                    
                    {/* Quick actions */}
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-white/80 backdrop-blur-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSingleStatus(product);
                        }}
                      >
                        <Image className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Product image */}
                    <div className="aspect-square bg-muted">
                      <img 
                        src={product.images[0] || '/placeholder.svg'} 
                        alt={product.nombre}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Product info */}
                    <div className="p-2">
                      <p className="text-sm font-medium truncate">{product.nombre}</p>
                      <p className="text-sm text-primary font-bold">
                        ${product.precio_venta.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Historial de catálogos */}
      {marketingHistory.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Historial
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {marketingHistory
                .slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage)
                .map(asset => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(asset.created_at).toLocaleDateString('es', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {asset.file_url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Re-abrir"
                        onClick={() => window.open(asset.file_url!, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Eliminar"
                      onClick={() => deleteAsset(asset).catch(() => toast.error('Error al eliminar'))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Paginación */}
            {marketingHistory.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Mostrando {(historyPage - 1) * itemsPerPage + 1} - {Math.min(historyPage * itemsPerPage, marketingHistory.length)} de {marketingHistory.length}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center px-3 text-sm">
                    Página {historyPage} de {Math.ceil(marketingHistory.length / itemsPerPage)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={historyPage >= Math.ceil(marketingHistory.length / itemsPerPage)}
                    onClick={() => setHistoryPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import from B2B catalog */}
      <B2BCatalogImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        storeId={storeId || ''}
        existingSkus={catalogItems.map(i => i.sku)}
        onSuccess={async () => {
          setImportDialogOpen(false);
          await refetch();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Eliminar productos?
            </DialogTitle>
            <DialogDescription>
              Estás a punto de eliminar <strong>{selectedProducts.size} producto{selectedProducts.size !== 1 ? 's' : ''}</strong> de tu catálogo.
              <br /><br />
              Esta acción no se puede deshacer. Los productos serán eliminados permanentemente y ya no podrás generar materiales de marketing con ellos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProducts}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SellerMarketingTools;
