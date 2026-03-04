import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, UserPlus, UserMinus, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { TrendingStore } from "@/hooks/useTrendingStores";
import { useStoreFollow } from "@/hooks/useTrendingStores";
import StoreReviewModal from "./StoreReviewModal";

interface TrendingStoreCardProps {
  store: TrendingStore;
  onFollowChange?: () => void;
}

const TrendingStoreCard = ({ store, onFollowChange }: TrendingStoreCardProps) => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { followStore, unfollowStore, checkIfFollowing } = useStoreFollow();
  const isB2B = user && (role === UserRole.SELLER || role === UserRole.ADMIN);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Check if user is following this store
  useState(() => {
    if (user) {
      checkIfFollowing(store.id, user.id).then(setIsFollowing).catch(() => {});
    }
  });

  const handleProductClick = (product: TrendingStore["products"][0]) => {
    navigate(`/producto/${product.sku}`);
  };

  const handleStoreClick = () => {
    if (store.slug) {
      navigate(`/tienda/${store.slug}`);
    }
  };

  const handleFollowToggle = async () => {
    if (!user) {
      toast({
        title: "Inicia sesión",
        description: "Necesitas iniciar sesión para seguir tiendas",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingFollow(true);
    try {
      if (isFollowing) {
        await unfollowStore(store.id, user.id);
        setIsFollowing(false);
        toast({ title: "Dejaste de seguir", description: `Ya no sigues a ${store.name}` });
      } else {
        await followStore(store.id, user.id);
        setIsFollowing(true);
        toast({ title: "Siguiendo", description: `Ahora sigues a ${store.name}` });
      }
      onFollowChange?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo completar la acción",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFollow(false);
    }
  };

  // Format followers count like "1.2K"
  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <>
      <div className="bg-card overflow-hidden animate-fade-in">
        {/* Store Header */}
        <div className="p-3 flex items-start gap-3">
          {/* Store Logo with Trends Badge */}
          <div 
            className="relative cursor-pointer flex-shrink-0"
            onClick={handleStoreClick}
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-muted border-2 border-border">
              {store.logo ? (
                <img 
                  src={store.logo} 
                  alt={store.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-bold text-lg">
                  {store.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Trends Badge - Orange/Purple like reference */}
            <Badge 
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-purple-600 text-white text-[9px] px-1.5 py-0 font-medium border-0 shadow-sm"
            >
              Trends
            </Badge>
          </div>

          {/* Store Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 
                className="font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors text-base"
                onClick={handleStoreClick}
              >
                {store.name}
              </h3>
              {store.newProductsCount > 5 && (
                <Badge variant="secondary" className="bg-muted text-foreground text-[10px] px-1.5 py-0">
                  Nuevo
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3 text-purple-500" />
                <span className="font-medium text-foreground">{store.salesCount}</span> vendido
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span>
                <span className="font-medium text-foreground">{formatCount(store.followers)}</span> seguidores
              </span>
              {store.newProductsCount > 0 && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span className="text-orange-500 font-medium">
                    {store.newProductsCount}+ Nuevo
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Follow Button */}
          <Button
            variant={isFollowing ? "outline" : "default"}
            size="sm"
            className={`h-8 px-3 text-xs ${isFollowing ? "text-muted-foreground" : "bg-orange-500 hover:bg-orange-600 text-white"}`}
            onClick={handleFollowToggle}
            disabled={isLoadingFollow}
          >
            {isFollowing ? (
              <>
                <UserMinus className="w-3 h-3 mr-1" />
                Siguiendo
              </>
            ) : (
              <>
                <UserPlus className="w-3 h-3 mr-1" />
                Seguir
              </>
            )}
          </Button>
        </div>

        {/* Products Grid - 4 columns with gap */}
        <div className="grid grid-cols-4 gap-1 px-3">
          {store.products.map((product) => (
            <div 
              key={product.id}
              className="cursor-pointer group"
              onClick={() => handleProductClick(product)}
            >
              <div className="aspect-[3/4] bg-muted overflow-hidden rounded">
                <img
                  src={product.imagen || '/placeholder.svg'}
                  alt={product.nombre}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              {/* Price in orange like reference */}
              <p className="text-orange-500 font-bold text-sm mt-1.5">
                <span className="text-orange-500/70 text-xs">$</span>
                <span className="text-orange-500/70 text-[10px]">MXN</span>
                <span className="text-orange-500">{product.precio_venta.toFixed(2)}</span>
              </p>
            </div>
          ))}
          
          {/* Fill empty slots if less than 4 products */}
          {store.products.length < 4 && 
            Array.from({ length: 4 - store.products.length }).map((_, i) => (
              <div key={`empty-${i}`}>
                <div className="aspect-[3/4] bg-muted/30 rounded" />
                <div className="h-5 mt-1.5" />
              </div>
            ))
          }
        </div>

        {/* Recent Review with quotes */}
        <div 
          className="px-3 py-3 flex items-start gap-1 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => user && setShowReviewModal(true)}
        >
          <span className="text-orange-400 text-xl leading-none font-serif">"</span>
          {store.recentReview ? (
            <p className="text-sm text-muted-foreground flex-1 line-clamp-1">
              <span className="font-medium text-foreground">{store.recentReview.author}:</span>
              {" "}{store.recentReview.text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/60 flex-1 italic">
              Sé el primero en dejar una reseña...
            </p>
          )}
          <span className="text-orange-400 text-xl leading-none font-serif">"</span>
          
          {user && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 ml-2 text-xs text-orange-500 hover:text-orange-600"
              onClick={(e) => {
                e.stopPropagation();
                setShowReviewModal(true);
              }}
            >
              <Star className="w-3 h-3 mr-1" />
              Reseñar
            </Button>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <StoreReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        store={store}
        onReviewSubmitted={onFollowChange}
      />
    </>
  );
};

export default TrendingStoreCard;
