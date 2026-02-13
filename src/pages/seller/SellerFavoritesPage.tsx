import { SellerLayout } from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, Trash2, Loader2, Package } from "lucide-react";
import { useB2BWishlist } from "@/hooks/useWishlist";
import { useB2BCartSupabase } from "@/hooks/useB2BCartSupabase";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

const SellerFavoritesPage = () => {
  const { items, isLoading, removeFromWishlist, isRemoving } = useB2BWishlist();
  const { addItem } = useB2BCartSupabase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  const handleAddToCart = async (item: typeof items[0]) => {
    if (!item.product_id) return;
    
    setAddingItemId(item.id);
    try {
      await addItem({
        productId: item.product_id,
        variantId: null, // No variant for wishlist items
        sku: item.sku || '',
        nombre: item.name || 'Producto',
        unitPrice: item.price || 0,
        quantity: item.moq || 1,
        moq: item.moq || 1,
        stockDisponible: 999,
      });
      toast.success('Producto agregado al carrito');
    } finally {
      setAddingItemId(null);
    }
  };

  const handleRemove = (item: typeof items[0]) => {
    removeFromWishlist({ 
      productId: item.product_id || undefined,
      wishlistItemId: item.id 
    });
  };

  if (!user) {
    return (
      <SellerLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <Card className="text-center py-12 max-w-md">
            <CardContent>
              <Heart className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Inicia sesión</h2>
              <p className="text-muted-foreground mb-6">
                Debes iniciar sesión para ver tus favoritos B2B.
              </p>
              <Button asChild>
                <Link to="/login">Iniciar Sesión</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </SellerLayout>
    );
  }

  if (isLoading) {
    return (
      <SellerLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Heart className="h-8 w-8 text-red-500 fill-current" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Mis Favoritos B2B</h1>
            <p className="text-muted-foreground text-sm">
              Productos del catálogo mayorista que te interesan
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tienes favoritos aún</h2>
              <p className="text-muted-foreground mb-6">
                Explora el catálogo B2B y guarda los productos que te interesan.
              </p>
              <Button asChild>
                <Link to="/seller/adquisicion-lotes">Ver Catálogo B2B</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden group">
                <div className="aspect-square relative">
                  <img
                    src={item.image || '/placeholder.svg'}
                    alt={item.name}
                    className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                    onClick={() => item.product_id && navigate(`/seller/producto/${item.product_id}`)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-500 hover:text-red-600 rounded-full h-8 w-8"
                    onClick={() => handleRemove(item)}
                    disabled={isRemoving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {item.moq && item.moq > 1 && (
                    <span className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                      MOQ: {item.moq}
                    </span>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm truncate mb-1">{item.name}</h3>
                  <p className="text-xs text-muted-foreground truncate mb-2">SKU: {item.sku}</p>
                  <p className="text-lg font-bold text-primary mb-3">
                    ${(item.price || 0).toFixed(2)}
                  </p>
                  <Button
                    className="w-full gap-2 h-9 text-sm"
                    variant="outline"
                    onClick={() => item.product_id && navigate(`/producto/${item.sku}`)}
                  >
                    <Package className="h-4 w-4" />
                    Ver
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  );
};

export default SellerFavoritesPage;
