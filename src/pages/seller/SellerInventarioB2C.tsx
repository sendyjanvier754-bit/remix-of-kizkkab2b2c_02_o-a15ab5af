import { useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useInventarioB2C, InventarioB2CItem } from "@/hooks/useInventarioB2C";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package, AlertCircle, Filter, ShoppingCart } from "lucide-react";
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

export default function SellerInventarioB2C() {
  const { user, isLoading: authLoading } = useAuth();
  const [filtro, setFiltro] = useState<'all' | 'available' | 'pending'>('all');
  
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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handlePublicar = (item: InventarioB2CItem) => {
    // TODO: Implementar lógica de publicación en B2C marketplace
    console.log('Publicar producto:', item);
    // Aquí podrías abrir un modal para configurar precio de venta, etc.
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
            <h1 className="text-3xl font-bold">Mi Inventario B2C</h1>
            <p className="text-muted-foreground mt-1">
              Productos de tus compras B2B disponibles para reventa
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
                Total Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalProductos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Unidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.totalUnidades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ✅ Disponibles
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
              <Card key={item.order_item_id} className="overflow-hidden hover:shadow-lg transition-shadow">
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
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Nombre */}
                  <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
                    {item.producto_nombre}
                  </h3>

                  {/* Detalles */}
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="font-mono text-xs">SKU: {item.sku}</p>
                    {item.color && <p>Color: {item.color}</p>}
                    {item.size && <p>Talla: {item.size}</p>}
                    <p className="font-semibold text-blue-600">
                      Stock: {item.stock} unidades
                    </p>
                  </div>

                  {/* Precio */}
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Precio sugerido</p>
                    <p className="text-xl font-bold">
                      ${item.precio_original?.toFixed(2)}
                    </p>
                  </div>

                  {/* Botón de acción */}
                  <Button
                    className="w-full"
                    onClick={() => handlePublicar(item)}
                    disabled={item.availability_status !== 'available'}
                  >
                    {item.availability_status === 'available' ? (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Publicar en B2C
                      </>
                    ) : (
                      '⏳ En tránsito'
                    )}
                  </Button>

                  {/* Info del pedido */}
                  <p className="text-xs text-muted-foreground text-center">
                    Pedido: {item.order_number}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
