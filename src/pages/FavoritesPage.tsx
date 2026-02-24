import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ShoppingCart, Trash2, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useB2CFavorites } from "@/hooks/useB2CFavorites";
import { useB2CCartSupabase } from "@/hooks/useB2CCartSupabase";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

const FavoritesPage = () => {
  const { items, isLoading, removeFavorite, isRemoving } = useB2CFavorites();
  const { addItem } = useB2CCartSupabase();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

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

  const handleAddToCart = async (item: typeof items[0]) => {
    setAddingItemId(item.id);
    try {
      await addItem({
        sku: item.sku || '',
        name: item.name || 'Producto',
        price: item.price || 0,
        image: item.image || '/placeholder.svg',
        storeId: item.store_id || undefined,
        storeName: item.store_name || '',
      });
    } finally {
      setAddingItemId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isMobile && <GlobalHeader />}
      <main className={`flex-1 container mx-auto px-4 py-4 ${isMobile ? 'pb-20' : 'pb-8'}`}>
        <h1 className="text-3xl font-bold mb-5 flex items-center gap-2">
          <Heart className="h-8 w-8 text-red-500 fill-current" />
          Mis Favoritos
        </h1>

        {items.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="flex justify-center mb-4">
                <Heart className="h-16 w-16 text-muted-foreground/50" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No tienes favoritos aún</h2>
              <p className="text-muted-foreground mb-6">
                Guarda los productos que te gustan para verlos más tarde.
              </p>
              <Button asChild>
                <Link to="/">Explorar productos</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-[3/4] relative">
                  <img
                    src={item.image || '/placeholder.svg'}
                    alt={item.name}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => navigate(`/producto/${item.sku || item.seller_catalog_id || item.product_id}`)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white text-red-500 hover:text-red-600 rounded-full"
                    onClick={() => removeFavorite({ favoriteId: item.id })}
                    disabled={isRemoving}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold truncate mb-1">{item.name}</h3>
                  {item.store_name && (
                    <p className="text-xs text-muted-foreground mb-1">{item.store_name}</p>
                  )}
                  <p className="text-lg font-bold text-primary mb-3">
                    ${item.price.toFixed(2)}
                  </p>
                  <Button
                    className="w-full gap-2"
                    onClick={() => handleAddToCart(item)}
                    disabled={addingItemId === item.id}
                  >
                    {addingItemId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-4 w-4" />
                    )}
                    Agregar al Carrito
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default FavoritesPage;
