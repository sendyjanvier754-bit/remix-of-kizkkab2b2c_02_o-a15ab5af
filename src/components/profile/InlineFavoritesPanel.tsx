import { useNavigate } from "react-router-dom";
import { useB2CFavorites } from "@/hooks/useB2CFavorites";
import { Heart, ShoppingCart, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

export function InlineFavoritesPanel() {
  const { items, isLoading, toggle, isRemoving } = useB2CFavorites();
  const { addItem } = useCart();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-background border border-border rounded-md p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
          <h2 className="text-sm font-bold text-foreground">Mis Favoritos</h2>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <Heart className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Aún no tienes favoritos</p>
          <p className="text-xs text-muted-foreground">Guarda productos que te gusten para verlos aquí</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/tiendas")}
            className="mt-2"
          >
            Explorar tiendas
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-border">
          {items.map((item) => (
            <div key={item.id} className="bg-background p-3 flex flex-col gap-2 group">
              {/* Image */}
              <div
                className="aspect-square rounded-md overflow-hidden bg-muted cursor-pointer relative"
                onClick={() => item.store_id && navigate(`/tienda/${item.store_id}`)}
              >
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                />
                {/* Remove favorite button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle({ sellerCatalogId: item.seller_catalog_id ?? undefined, productId: item.product_id ?? undefined });
                  }}
                  disabled={isRemoving}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                >
                  <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                </button>
              </div>

              {/* Info */}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                {item.store_name && (
                  <p className="text-[10px] text-muted-foreground truncate">{item.store_name}</p>
                )}
                <p className="text-sm font-bold text-foreground mt-0.5">
                  ${item.price.toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 mt-auto">
                <button
                  onClick={() => {
                    addItem({
                      seller_catalog_id: item.seller_catalog_id ?? undefined,
                      nombre: item.name,
                      precio_venta: item.price,
                      imagen_principal: item.image,
                      sku: item.sku,
                      store_id: item.store_id ?? undefined,
                    } as any);
                    toast.success("Agregado al carrito");
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  <ShoppingCart className="w-3 h-3" /> Agregar
                </button>
                {item.store_id && (
                  <button
                    onClick={() => navigate(`/tienda/${item.store_id}`)}
                    className="w-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
