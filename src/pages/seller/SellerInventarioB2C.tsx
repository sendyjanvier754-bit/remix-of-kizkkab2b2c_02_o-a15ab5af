import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useInventarioB2C, InventarioB2CItem, InventarioB2CVariante } from "@/hooks/useInventarioB2C";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package, AlertCircle, Filter, ShoppingCart, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PublishToB2CModal, PublishData } from "@/components/seller/PublishToB2CModal";
import { usePublishToB2C } from "@/hooks/usePublishToB2C";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SellerInventarioB2C() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const [filtro, setFiltro] = useState<'all' | 'available' | 'pending'>('all');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [selectedItemToPublish, setSelectedItemToPublish] = useState<InventarioB2CItem | null>(null);
  
  const { 
    inventario, 
    stats, 
    isLoading, 
    error,
    refetch,
    getProductosDisponibles,
    getProductosPendientes
  } = useInventarioB2C({
    availability_status: filtro === 'all' ? undefined : filtro,
    limit: 100,
  });

  const { publish } = usePublishToB2C();
  
  // Obtener store_id del usuario
  const { data: storeData } = useQuery({
    queryKey: ['user-store', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handlePublicar = (item: InventarioB2CItem) => {
    setSelectedItemToPublish(item);
    setPublishModalOpen(true);
  };

  const handlePublishSubmit = async (data: PublishData) => {
    if (!storeData?.id) {
      alert('No se encontró tu tienda. Contacta a soporte.');
      return;
    }

    await publish({
      ...data,
      storeId: storeData.id,
    });
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

  if (error) {
    return (
      <SellerLayout>
        <Alert variant="destructive" className="m-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('sellerInventory.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('sellerInventory.subtitle')}
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="icon"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('sellerInventory.totalProducts')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalProductos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('sellerInventory.totalUnits')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.totalUnidades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ✅ {t('sellerInventory.available')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.productosDisponibles}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ⏳ Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats.productosPendientes}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtro} onValueChange={(value: any) => setFiltro(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Todos ({inventario.length})
              </SelectItem>
              <SelectItem value="available">
                ✅ Disponibles ({getProductosDisponibles().length})
              </SelectItem>
              <SelectItem value="pending">
                ⏳ Pendientes ({getProductosPendientes().length})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de productos */}
        {inventario.length === 0 ? (
          <div className="text-center py-12 bg-muted/50 rounded-lg">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin productos en inventario</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Los productos de tus pedidos B2B pagados aparecerán aquí
            </p>
            <Button asChild>
              <a href="/seller/adquisicion-lotes">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Ver Catálogo B2B
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {inventario.map((item) => (
              <ProductCard 
                key={item.product_id} 
                item={item} 
                onPublicar={handlePublicar}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Modal de publicación */}
      {selectedItemToPublish && (
        <PublishToB2CModal
          open={publishModalOpen}
          onClose={() => {
            setPublishModalOpen(false);
            setSelectedItemToPublish(null);
          }}
          item={selectedItemToPublish}
          onPublish={handlePublishSubmit}
        />
      )}
    </SellerLayout>
  );
}

// Componente para cada tarjeta de producto con variantes
function ProductCard({ 
  item, 
  onPublicar 
}: { 
  item: InventarioB2CItem;
  onPublicar: (item: InventarioB2CItem) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Imagen */}
      <div className="relative h-48 bg-gray-100">
        <img
          src={item.imagen_principal}
          alt={item.producto_nombre}
          className="w-full h-full object-cover"
        />
        
        {/* Badge de disponibilidad */}
        <div className="absolute top-2 right-2">
          {item.availability_status === 'available' ? (
            <Badge className="bg-green-500">✅ Disponible</Badge>
          ) : item.availability_status === 'pending' ? (
            <Badge className="bg-amber-500">⏳ Pendiente</Badge>
          ) : (
            <Badge variant="secondary">❌ Cancelado</Badge>
          )}
        </div>
        
        {/* Badge de cantidad de variantes */}
        {item.variantes.length > 1 && (
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className="bg-white/90">
              {item.variantes.length} variantes
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Nombre */}
        <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
          {item.producto_nombre}
        </h3>

        {/* Resumen */}
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-semibold text-blue-600">
            <Package className="h-4 w-4 inline mr-1" />
            Total Stock: {item.total_stock} unidades
          </p>
          <p className="text-xs">
            Precio pagado B2B: <span className="font-bold text-green-700">${item.precio_promedio?.toFixed(2)}</span>
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1" size="sm">
                Ver más
              </Button>
            </DialogTrigger>
            
            <VariantesModal 
              item={item} 
              onClose={() => setIsModalOpen(false)}
            />
          </Dialog>
          
          <Button 
            className="flex-1" 
            size="sm"
            onClick={() => onPublicar(item)}
            disabled={item.availability_status === 'cancelled'}
          >
            <ShoppingCart className="h-3 w-3 mr-2" />
            Publicar
          </Button>
        </div>

        {/* Info del pedido */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>Pedido: {item.order_number}</p>
          <p>Tienda: {item.tienda_vendedor}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Modal con paginación para mostrar variantes
function VariantesModal({ 
  item, 
  onClose 
}: { 
  item: InventarioB2CItem;
  onClose: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [imageZoom, setImageZoom] = useState<string | null>(null);
  const itemsPerPage = 6;
  
  const totalPages = Math.ceil(item.variantes.length / itemsPerPage);
  const startIdx = currentPage * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentVariantes = item.variantes.slice(startIdx, endIdx);
  
  return (
    <>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{item.producto_nombre}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {item.variantes.length} variante{item.variantes.length > 1 ? 's' : ''} disponible{item.variantes.length > 1 ? 's' : ''}
          </p>
        </DialogHeader>
        
        {/* Grid de variantes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {currentVariantes.map((variante, idx) => (
            <Card key={variante.variant_id || idx} className="overflow-hidden">
              {/* Imagen de la variante */}
              <div 
                className="relative h-48 bg-gray-100 cursor-pointer group"
                onClick={() => setImageZoom(item.imagen_principal)}
              >
                <img
                  src={item.imagen_principal}
                  alt={`${item.producto_nombre} - ${variante.color} ${variante.size}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              
              <CardContent className="p-4 space-y-2">
                <div className="space-y-1">
                  <p className="font-mono text-xs text-muted-foreground">
                    SKU: {variante.sku}
                  </p>
                  
                  <div className="flex gap-2">
                    {variante.color && (
                      <Badge variant="outline">
                        {variante.color}
                      </Badge>
                    )}
                    {variante.size && (
                      <Badge variant="outline">
                        Talla: {variante.size}
                      </Badge>
                    )}
                  </div>
                  
                   <div className="flex justify-between items-center pt-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Stock</p>
                      <p className="text-xl font-bold text-blue-600">
                        {variante.stock}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Precio pagado</p>
                      <p className="text-xl font-bold text-green-700">
                        ${variante.precio_original?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
      
      {/* Lightbox para zoom de imagen */}
      {imageZoom && (
        <Dialog open={!!imageZoom} onOpenChange={() => setImageZoom(null)}>
          <DialogContent className="max-w-4xl p-2">
            <button
              onClick={() => setImageZoom(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <img
              src={imageZoom}
              alt="Zoom"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
