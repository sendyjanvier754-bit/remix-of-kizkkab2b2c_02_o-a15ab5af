import { SellerLayout } from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Trash2, Loader2, Package, LayoutGrid } from "lucide-react";
import { useB2BFavorites } from "@/hooks/useB2BFavorites";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";

const SellerFavoritesPage = () => {
  const { items, isLoading, removeFavorite, isRemoving } = useB2BFavorites();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Build unique category list from items
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(item => {
      if (item.categoria_id && item.categoria_name) {
        map.set(item.categoria_id, item.categoria_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Filter items by selected category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(item => item.categoria_id === selectedCategory);
  }, [items, selectedCategory]);

  const handleRemove = (item: typeof items[0]) => {
    removeFavorite({ favoriteId: item.id });
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <Heart className="h-8 w-8 text-red-500 fill-current" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Mis Favoritos B2B</h1>
            <p className="text-muted-foreground text-sm">
              Productos del catálogo mayorista que te interesan
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
          <>
            {/* Category filter tabs */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedCategory === null
                      ? 'bg-[#071d7f] text-white border-[#071d7f]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#071d7f] hover:text-[#071d7f]'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Todas
                  <Badge
                    variant="secondary"
                    className={`ml-1 text-[10px] h-4 min-w-[18px] px-1 ${
                      selectedCategory === null ? 'bg-white/20 text-white' : ''
                    }`}
                  >
                    {items.length}
                  </Badge>
                </button>

                {categories.map(cat => {
                  const count = items.filter(i => i.categoria_id === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-[#071d7f] text-white border-[#071d7f]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#071d7f] hover:text-[#071d7f]'
                      }`}
                    >
                      {cat.name}
                      <Badge
                        variant="secondary"
                        className={`ml-1 text-[10px] h-4 min-w-[18px] px-1 ${
                          selectedCategory === cat.id ? 'bg-white/20 text-white' : ''
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
                No hay productos en esta categoría.
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
                        onClick={() => item.sku && navigate(`/producto/${item.sku}`)}
                      />
                      <button
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-500 hover:text-red-600 rounded-full h-8 w-8 flex items-center justify-center transition-colors"
                        onClick={() => handleRemove(item)}
                        disabled={isRemoving}
                        title="Eliminar de favoritos"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {item.moq && item.moq > 1 && (
                        <span className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                          MOQ: {item.moq}
                        </span>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-1">
                      {item.categoria_name && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                          {item.categoria_name}
                        </p>
                      )}
                      <h3 className="font-medium text-sm truncate leading-snug">{item.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">SKU: {item.sku}</p>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-base font-bold text-primary">
                          ${(item.price || 0).toFixed(2)}
                        </p>
                        <Button
                          className="gap-1 h-8 text-xs"
                          variant="outline"
                          onClick={() => item.sku && navigate(`/producto/${item.sku}`)}
                        >
                          <Package className="h-3.5 w-3.5" />
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
      </div>
    </SellerLayout>
  );
};

export default SellerFavoritesPage;
