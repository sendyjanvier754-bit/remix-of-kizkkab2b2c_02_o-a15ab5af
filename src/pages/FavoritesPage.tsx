import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Trash2, Loader2, Store, LayoutGrid } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useB2CFavorites } from "@/hooks/useB2CFavorites";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo } from "react";

const FavoritesPage = () => {
  const { items, isLoading, removeFavorite, isRemoving } = useB2CFavorites();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  // Build unique store list from favorites
  const stores = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(item => {
      if (item.store_id && item.store_name) {
        map.set(item.store_id, item.store_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Filter items by selected store
  const filteredItems = useMemo(() => {
    if (!selectedStore) return items;
    return items.filter(item => item.store_id === selectedStore);
  }, [items, selectedStore]);

  const getProductUrl = (item: typeof items[0]) => {
    if (item.seller_catalog_id) return `/producto/catalogo/${item.seller_catalog_id}`;
    if (item.sku) return `/producto/${item.sku}`;
    return '/tiendas';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="text-center py-12 max-w-md">
            <CardContent>
              <Heart className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Inicia sesión</h2>
              <p className="text-muted-foreground mb-6">
                Debes iniciar sesión para ver tus favoritos.
              </p>
              <Button asChild>
                <Link to="/login">Iniciar Sesión</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isMobile && <GlobalHeader />}
      <main className={`flex-1 container mx-auto px-4 py-4 ${isMobile ? 'pb-20' : 'pb-8'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Heart className="h-8 w-8 text-red-500 fill-current" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Mis Favoritos</h1>
            <p className="text-muted-foreground text-sm">
              Productos que guardaste para más tarde
              {items.length > 0 && (
                <span className="ml-2 font-medium text-foreground">
                  ({items.length} {items.length === 1 ? 'producto' : 'productos'})
                </span>
              )}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Store className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tienes favoritos aún</h2>
              <p className="text-muted-foreground mb-6">
                Explora las tiendas y guarda los productos que te gustan.
              </p>
              <Button asChild>
                <Link to="/">Explorar tiendas</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Store filter tabs */}
            {stores.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setSelectedStore(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedStore === null
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Todas
                  <Badge
                    variant="secondary"
                    className={`ml-1 text-[10px] h-4 min-w-[18px] px-1 ${
                      selectedStore === null ? 'bg-white/20 text-white' : ''
                    }`}
                  >
                    {items.length}
                  </Badge>
                </button>

                {stores.map(store => {
                  const count = items.filter(i => i.store_id === store.id).length;
                  return (
                    <button
                      key={store.id}
                      onClick={() => setSelectedStore(store.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedStore === store.id
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
                      }`}
                    >
                      {store.name}
                      <Badge
                        variant="secondary"
                        className={`ml-1 text-[10px] h-4 min-w-[18px] px-1 ${
                          selectedStore === store.id ? 'bg-white/20 text-white' : ''
                        }`}
                      >
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Items grid */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay productos de esta tienda en favoritos.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden group">
                    <div className="aspect-square relative">
                      <img
                        src={item.image || '/placeholder.svg'}
                        alt={item.name}
                        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                        onClick={() => navigate(getProductUrl(item))}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                      />
                      <button
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-500 hover:text-red-600 rounded-full h-8 w-8 flex items-center justify-center transition-colors"
                        onClick={() => removeFavorite({ favoriteId: item.id })}
                        disabled={isRemoving}
                        title="Eliminar de favoritos"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <CardContent className="p-3 space-y-1">
                      {item.store_name && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                          {item.store_name}
                        </p>
                      )}
                      <h3 className="font-medium text-sm truncate leading-snug">{item.name}</h3>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-base font-bold text-primary">
                          ${(item.price || 0).toFixed(2)}
                        </p>
                        <Button
                          className="gap-1 h-8 text-xs"
                          variant="outline"
                          onClick={() => navigate(getProductUrl(item))}
                        >
                          <Store className="h-3.5 w-3.5" />
                          Ver
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default FavoritesPage;
