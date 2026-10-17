import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useStore, useStoreProducts } from "@/hooks/useStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MapPin, Star, Store as StoreIcon, Filter, ShoppingBag, Package } from "lucide-react";
import { useState } from "react";

const StorePage = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const { data: store, isLoading: isLoadingStore } = useStore(sellerId);
  const { data: productsData, isLoading: isLoadingProducts } = useStoreProducts(sellerId);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter by search term using seller_catalog fields directly
  const filteredProducts = productsData?.products?.filter((item: any) => {
    if (!item) return false;
    return item.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="h-64 bg-gray-200 animate-pulse" />
        <main className="container mx-auto px-4 -mt-20 relative z-10 pb-12">
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <div className="flex gap-4 items-end">
                    <div className="w-32 h-32 bg-gray-300 rounded-lg animate-pulse" />
                    <div className="space-y-2 flex-1">
                        <div className="h-8 bg-gray-300 rounded w-1/3 animate-pulse" />
                        <div className="h-4 bg-gray-300 rounded w-1/4 animate-pulse" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-80 bg-gray-200 rounded-xl animate-pulse" />
                ))}
            </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 flex items-center justify-center">
            <div className="text-center space-y-4">
                <StoreIcon className="h-16 w-16 text-gray-300 mx-auto" />
                <h1 className="text-2xl font-bold text-gray-900">Tienda no encontrada</h1>
                <p className="text-gray-500">La tienda que buscas no existe o ha sido desactivada.</p>
                <Button onClick={() => window.history.back()}>Volver</Button>
            </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header />
      
      {/* Hero Section - Compact */}
      <div className="relative h-24 md:h-32 w-full overflow-hidden bg-gray-900">
        {store.banner ? (
            <img 
                src={store.banner} 
                alt={store.name} 
                className="w-full h-full object-cover opacity-80"
            />
        ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-900 to-indigo-900 opacity-90" />
        )}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <main className="container mx-auto px-3 md:px-4 pb-12 md:pb-16 -mt-12 md:-mt-24 relative z-10">
        {/* Store Profile Card - Compact */}
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg md:shadow-xl border border-gray-100 p-4 md:p-8 mb-8">
            <div className="flex flex-col sm:flex-row gap-3 md:gap-6 sm:items-end">
                <div className="relative -mt-12 md:-mt-20 flex-shrink-0">
                    <Avatar className="h-20 w-20 md:h-40 md:w-40 border-2 md:border-4 border-white shadow-md md:shadow-lg rounded-lg md:rounded-xl">
                        <AvatarImage src={store.logo || ""} alt={store.name} className="object-cover" />
                        <AvatarFallback className="text-xl md:text-4xl font-bold bg-blue-50 text-blue-900 rounded-lg md:rounded-xl">
                            {store.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    {store.is_active && (
                        <div className="absolute bottom-0 right-0 bg-green-500 text-white p-1 md:p-1.5 rounded-full border-2 md:border-4 border-white shadow-sm" title="Verificado">
                            <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 space-y-2 md:space-y-3 text-center sm:text-left">
                    <div className="min-w-0">
                        <h1 className="text-lg md:text-4xl font-bold text-gray-900 tracking-tight truncate">{store.name}</h1>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1 flex items-center justify-center sm:justify-start gap-1 truncate">
                            <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="truncate">{store.slug ? `@${store.slug}` : "Verificado"}</span>
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-0.5 text-xs md:px-3 md:py-1">
                            <Star className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1 fill-blue-700" />
                            4.9
                        </Badge>
                        <Badge variant="outline" className="border-gray-200 text-gray-600 text-xs md:px-3 md:py-1 px-2 py-0.5">
                            <ShoppingBag className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
                            {productsData?.total || 0}
                        </Badge>
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto flex-shrink-0 text-xs md:text-sm">
                    <Button size="sm" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 h-8 md:h-10 text-xs md:text-sm">
                        Contactar
                    </Button>
                </div>
            </div>

            {store.description && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Sobre la tienda</h3>
                    <p className="text-gray-600 leading-relaxed max-w-3xl">
                        {store.description}
                    </p>
                </div>
            )}
        </div>

        {/* Products Section */}
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    Catálogo de Productos
                </h2>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Buscar en esta tienda..." 
                            className="pl-10 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon" className="bg-white">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isLoadingProducts ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="space-y-4">
                            <Skeleton className="h-48 w-full rounded-xl" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    ))}
                </div>
            ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((item: any) => {
                        // Use seller_catalog fields directly (nombre, precio_venta, images, stock)
                        let images = item.images;
                        if (typeof images === 'string') {
                          try { images = JSON.parse(images); } catch { images = []; }
                        }
                        const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : null;
                        const outOfStock = (item.stock ?? 0) === 0;
                        const disponiblePronto = item.metadata?.disponible_pronto === true;

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-xl overflow-hidden hover:shadow-xl transition duration-300 cursor-pointer border border-gray-100"
                            onClick={() => navigate(`/producto/${item.sku}`)}
                          >
                            {/* Image */}
                            <div className="relative h-48 bg-gray-100 overflow-hidden group">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.nombre}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                                  <Package className="h-12 w-12" />
                                </div>
                              )}
                              {/* Stock badge */}
                              {disponiblePronto ? (
                                <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                  Disponible Pronto
                                </span>
                              ) : outOfStock ? (
                                <span className="absolute top-2 left-2 bg-gray-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                  Agotado
                                </span>
                              ) : null}
                            </div>

                            {/* Info */}
                            <div className="p-3">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                                {item.nombre}
                              </h3>
                              <p className="text-lg font-bold text-gray-900">
                                ${Number(item.precio_venta || 0).toFixed(2)}
                              </p>
                              {!outOfStock && !disponiblePronto && (
                                <p className="text-xs text-green-600 font-medium mt-0.5">
                                  Stock: {item.stock}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No se encontraron productos</h3>
                    <p className="text-gray-500 mt-1">Intenta con otra búsqueda o revisa más tarde.</p>
                    {searchQuery && (
                        <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-blue-600">
                            Limpiar búsqueda
                        </Button>
                    )}
                </div>
            )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default StorePage;
