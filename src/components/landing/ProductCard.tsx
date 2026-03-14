import { Heart, Package, Store, TrendingUp, ShoppingCart, MessageCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import useVariantDrawerStore from "@/stores/useVariantDrawerStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { useViewMode } from "@/contexts/ViewModeContext";

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  discount?: number;
  badge?: string;
  sku: string;
  storeId?: string;
  storeName?: string;
  storeWhatsapp?: string;
  isSellerVerified?: boolean;
  rating?: number;
  // B2B fields (legacy/fallback)
  priceB2B?: number;
  pvp?: number;
  moq?: number;
  stock?: number;
  // Promo fields from database
  precio_promocional?: number | null;
  promo_active?: boolean | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  currency_code?: string | null;
  // Source product reference
  source_product_id?: string;
}

interface ProductB2BData {
  price_b2b: number;
  suggested_pvp: number;
  moq: number;
  stock: number;
}

interface ProductCardProps {
  product: Product;
  b2bData?: ProductB2BData;
}

const ProductCard = ({ product, b2bData }: ProductCardProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isB2BUser = user?.role === UserRole.SELLER || user?.role === UserRole.ADMIN;

  // Calcular precios según el contexto
  // Priorizamos b2bData si existe, sino usamos los campos del producto (fallback)
  const costB2B = b2bData?.price_b2b || product.priceB2B || product.price;
  const pvp = b2bData?.suggested_pvp || product.pvp || product.originalPrice || product.price;
  const moq = b2bData?.moq || product.moq || 1;
  
  const profit = pvp - costB2B;
  
  // Check if promo is active using database fields
  const isPromoActive = (): boolean => {
    if (!product.promo_active || !product.precio_promocional) return false;
    const now = new Date();
    const startsAt = product.promo_starts_at ? new Date(product.promo_starts_at) : null;
    const endsAt = product.promo_ends_at ? new Date(product.promo_ends_at) : null;
    
    if (startsAt && now < startsAt) return false;
    if (endsAt && now > endsAt) return false;
    return true;
  };
  
  const promoActive = isPromoActive();
  const promoPrice = promoActive ? product.precio_promocional : null;
  const currency = product.currency_code || 'USD';

  // Calculate discount percentage for promo or legacy
  const discountPercentage = promoActive && promoPrice && product.price > promoPrice
    ? Math.round(((product.price - promoPrice) / product.price) * 100)
    : product.originalPrice
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : product.discount || 0;

  // Precio a mostrar según rol
  // B2C: si hay promo activa, mostrar precio promo, sino precio normal
  // B2B (Seller/Admin): precio mayorista
  const displayPrice = isB2BUser 
    ? costB2B 
    : (promoActive && promoPrice ? promoPrice : product.price);
  
  // Precio tachado/referencia
  // Si es B2B: mostramos PVP tachado
  // Si es cliente B2C con promo: mostramos precio original tachado
  // Si es cliente sin promo: mostramos originalPrice si existe
  const strikethroughPrice = isB2BUser 
    ? pvp 
    : (promoActive && promoPrice ? product.price : product.originalPrice);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    useVariantDrawerStore.getState().open({
      id: product.id,
      sku: product.sku,
      nombre: product.name,
      images: product.image ? [product.image] : [],
      price: displayPrice,
      costB2B: costB2B,
      moq: moq,
      stock: b2bData?.stock || product.stock || 0,
      source_product_id: product.source_product_id,
      storeId: product.storeId,
      sellerCatalogId: product.id,
    });
  };

  return (
    <>
    <div className="bg-card rounded-lg overflow-hidden hover:shadow-lg transition group border border-border h-full flex flex-col">
      {/* Image Container */}
      <Link to={product.sku ? `/producto/${product.sku}${product.storeId ? `?seller=${product.storeId}` : ''}` : '#'} className="relative block">
        <div className="relative overflow-hidden aspect-square bg-muted">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Promo/Discount Badge - Solo para B2C */}
          {!isB2BUser && discountPercentage > 0 && (
            <div className={`absolute top-2 left-2 ${promoActive ? 'bg-red-600' : 'bg-[#071d7f]'} text-white px-2 py-1 rounded text-xs font-bold z-10`}>
              {promoActive ? `🔥 ${discountPercentage}% OFF` : `${discountPercentage}% DESC`}
            </div>
          )}

          {/* B2B Profitability Badge - "Ganas: $..." */}
          {isB2BUser && profit > 0 && (
            <Badge className="absolute top-2 left-2 bg-green-600 hover:bg-green-700 text-white gap-1 z-10 shadow-sm border-0">
              <TrendingUp className="h-3 w-3" />
              Ganas: ${profit.toFixed(2)}
            </Badge>
          )}

          {/* Custom Badge */}
          {product.badge && !isB2BUser && (
            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold z-10 ${
              product.badge === 'Agotado' 
                ? 'bg-red-500 text-white' 
                : product.badge === 'Disponible Pronto' 
                  ? 'bg-amber-400 text-gray-900' 
                  : product.badge === 'Disponible'
                    ? 'bg-green-500 text-white'
                    : 'bg-yellow-400 text-gray-900'
            }`}>
              {product.badge}
            </div>
          )}

          {/* Seller Verification Badge - Only show if no custom badge */}
          {!isB2BUser && product.isSellerVerified && !product.badge && (
            <div className="absolute top-2 right-2 flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground bg-white/90 px-1.5 py-0.5 rounded z-10">
              <ShieldCheck className="w-3 h-3 text-orange-500" />
              Verified
            </div>
          )}

          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFavorite(!isFavorite);
            }}
            className="absolute top-2 right-2 p-2 rounded-full bg-white/80 hover:bg-white transition z-20"
          >
            <Heart
              className={`w-4 h-4 ${
                isFavorite ? "fill-red-500 text-red-500" : "text-gray-600"
              }`}
            />
          </button>
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-1 flex flex-col flex-1">
        <Link to={product.sku ? `/producto/${product.sku}${product.storeId ? `?seller=${product.storeId}` : ''}` : '#'}>
          <h3 className="text-sm font-medium text-foreground line-clamp-1 mb-1 hover:text-primary transition h-5">
            {product.name}
          </h3>
        </Link>

        {/* MOQ Label for Seller */}
        {isB2BUser && moq > 1 && (
          <div className="text-xs text-amber-600 font-medium mb-2">
            Mínimo: {moq} unidades
          </div>
        )}

        {/* Precios */}
        <Link to={product.sku ? `/producto/${product.sku}${product.storeId ? `?seller=${product.storeId}` : ''}` : '#'}>
          <div className="flex items-baseline gap-2 flex-wrap hover:opacity-80 transition-opacity mb-3">
            {/* Price badge with currency from database */}
            <span className="inline-flex items-center gap-1 bg-[#ef481b] border border-[#ef481b] px-1 py-0.5 rounded-md animate-pulse">
              <span className="text-white font-bold text-xs">${displayPrice.toFixed(2)}</span>
              <span className="text-[7px] font-medium text-white">{currency}</span>
            </span>
            
            {/* Rating Display */}
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-yellow-500">
              <span className="text-sm">★</span>
              {(product.rating || 0).toFixed(1)}
            </span>
            
            {isB2BUser && strikethroughPrice && strikethroughPrice > displayPrice && (
              <span className="text-[9px] text-green-600 font-semibold">
                ${strikethroughPrice.toFixed(2)} PVP
              </span>
            )}
            {!isB2BUser && strikethroughPrice && strikethroughPrice > displayPrice && (
              <span className="text-[9px] text-muted-foreground line-through">
                ${strikethroughPrice.toFixed(2)}
              </span>
            )}
          </div>
        </Link>

        {/* Action Buttons - Footer */}
        <div className="mt-auto flex items-center gap-1.5 pt-3">
          {/* WhatsApp Contact Button */}
          <a
            href={product.storeWhatsapp ? `https://wa.me/${product.storeWhatsapp.replace(/\D/g, '')}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg transition shadow-sm flex items-center justify-center bg-green-500 hover:bg-green-600 text-white"
            title="Contactar por WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </a>
          
          {/* Cart Button */}
          <button 
            onClick={handleAddToCart}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition shadow-sm flex items-center justify-center gap-1 bg-primary hover:bg-primary/90 text-white`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {isB2BUser ? "B2B" : "Carrito"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default ProductCard;