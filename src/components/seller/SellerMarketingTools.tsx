import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  openPDFCatalog, 
  downloadWhatsAppStatusImage, 
  downloadWhatsAppStatusBulk,
  type WhatsAppStatusOptions
} from '@/services/marketingGenerators';
import { useSellerCatalog } from '@/hooks/useSellerCatalog';
import { useStore } from '@/hooks/useStore';
import { useAuth } from '@/hooks/useAuth';

interface CatalogProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  images: string[];
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
  const { items: catalogItems, storeId } = useSellerCatalog();
  const { data: store } = useStore(storeId || undefined);
  
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [previewProduct, setPreviewProduct] = useState<string | null>(null);

  // Transform catalog items to CatalogProduct format
  const products: CatalogProduct[] = useMemo(() => {
    return catalogItems.map(item => ({
      id: item.id,
      sku: item.sku,
      nombre: item.nombre,
      descripcion: item.descripcion,
      precio_venta: item.precioVenta,
      images: item.images,
      variants: [], // Would need to fetch from product_variants if needed
      store_slug: store?.slug || '',
      store_name: store?.name || '',
    }));
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

  // Generate PDF Catalog
  const handleGeneratePDF = async () => {
    if (selectedProductsData.length === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      await openPDFCatalog({
        products: selectedProductsData,
        storeId: storeId || '',
        storeName: store?.name || 'Mi Tienda',
        storeLogo: store?.logo || undefined,
        storeSlug: store?.slug || '',
        primaryColor: '#8B5CF6',
        showQR: true,
        trackingEnabled: true,
      });
      toast.success('Catálogo PDF generado');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar catálogo');
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
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Herramientas de Marketing
          </CardTitle>
          <CardDescription>
            Genera catálogos PDF e imágenes para WhatsApp Status con tracking integrado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="gap-1">
              <Check className="h-3 w-3" />
              {selectedProducts.size} seleccionados
            </Badge>
            <Button variant="outline" size="sm" onClick={selectAll}>
              Seleccionar todo
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Limpiar selección
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PDF Catalog */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Catálogo PDF
            </CardTitle>
            <CardDescription>
              Genera un catálogo interactivo con QR codes y deep links
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Imágenes de alta calidad</li>
              <li>✓ Miniaturas de variantes clickeables</li>
              <li>✓ QR codes con tracking</li>
              <li>✓ Links directos a tu tienda</li>
            </ul>
            <Button 
              onClick={handleGeneratePDF} 
              disabled={isGeneratingPDF || selectedProducts.size === 0}
              className="w-full"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Generar y Ver PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="h-5 w-5 text-green-500" />
              WhatsApp Status
            </CardTitle>
            <CardDescription>
              Imágenes optimizadas 9:16 para estados de WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Formato vertical optimizado</li>
              <li>✓ Diseño atractivo con precios</li>
              <li>✓ QR code para compra directa</li>
              <li>✓ Descarga masiva en ZIP</li>
            </ul>
            
            {isGeneratingImages && downloadProgress.total > 0 && (
              <div className="space-y-2">
                <Progress 
                  value={(downloadProgress.current / downloadProgress.total) * 100} 
                />
                <p className="text-xs text-muted-foreground text-center">
                  Procesando {downloadProgress.current} de {downloadProgress.total}
                </p>
              </div>
            )}
            
            <Button 
              onClick={handleDownloadBulkStatus} 
              disabled={isGeneratingImages || selectedProducts.size === 0}
              className="w-full"
              variant="outline"
            >
              {isGeneratingImages ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando ZIP...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar {selectedProducts.size > 0 ? `${selectedProducts.size} imágenes` : 'Selecciona productos'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Products Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Productos del Catálogo</CardTitle>
          <CardDescription>
            Selecciona los productos a incluir en tus materiales de marketing
          </CardDescription>
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
                <Button asChild variant="default" style={{ backgroundColor: '#071d7f' }}>
                  <a href="/seller/inventario">
                    <Download className="h-4 w-4 mr-2" />
                    Importar desde B2B
                  </a>
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
  );
};

export default SellerMarketingTools;
