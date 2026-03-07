import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useStore, useStoreProducts, useStoreSales } from "@/hooks/useStore";
import ProductCard from "@/components/landing/ProductCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { PaymentMethodsDisplay, PaymentMethodsData } from "@/components/shared/PaymentMethodsDisplay";
import { useStoreFollow } from "@/hooks/useTrendingStores";
import { supabase } from "@/integrations/supabase/client";
import {
  Star,
  MessageCircle,
  Heart,
  Share2,
  MapPin,
  Clock,
  ShoppingBag,
  TrendingUp,
  CheckCircle,
  Search,
  Facebook,
  Instagram,
  Phone,
  Video,
  ExternalLink
} from "lucide-react";

const COUNTRIES_MAP: Record<string, string> = {
  "CO": "Colombia",
  "MX": "México",
  "AR": "Argentina",
  "CL": "Chile",
  "PE": "Perú",
  "US": "Estados Unidos",
  "ES": "España",
  "OT": "Internacional"
};

const StoreProfilePage = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch real store data — resolves slug OR uuid to full store object
  const { data: storeData, isLoading: isStoreLoading } = useStore(storeId);

  // Use the real UUID (storeData.id) for all sub-queries — never pass the slug directly
  const realStoreId = storeData?.id;
  const { data: productsData, isLoading: isProductsLoading } = useStoreProducts(realStoreId);
  const { data: totalSales30Days } = useStoreSales(realStoreId);

  // Real followers count — use storeData.id (UUID), not the slug
  const { data: followersCount = 0, refetch: refetchFollowers } = useQuery({
    queryKey: ["store-followers-count", storeData?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("store_followers")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeData!.id);
      return count || 0;
    },
    enabled: !!storeData?.id,
  });

  // Real store rating from store_reviews
  const { data: ratingData } = useQuery({
    queryKey: ["store-rating", storeData?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_reviews")
        .select("rating")
        .eq("store_id", storeData!.id);
      if (!data || data.length === 0) return null;
      const avg = data.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!storeData?.id,
  });

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const { followStore, unfollowStore, checkIfFollowing } = useStoreFollow();

  useEffect(() => {
    if (storeData?.id && user?.id) {
      checkIfFollowing(storeData.id, user.id).then(setIsFollowing).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeData?.id, user?.id]);

  const handleFollowToggle = async () => {
    if (!user) {
      toast({ title: "Inicia sesión para seguir esta tienda", variant: "destructive" });
      return;
    }
    if (!storeData?.id) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowStore(storeData.id, user.id);
        setIsFollowing(false);
      } else {
        await followStore(storeData.id, user.id);
        setIsFollowing(true);
      }
      refetchFollowers();
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el seguimiento.", variant: "destructive" });
    } finally {
      setFollowLoading(false);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerSliding, setBannerSliding] = useState(false);

  // Auto-cycle banner with configurable interval (default 3s)
  useEffect(() => {
    const banners = storeData?.banner_images?.length
      ? storeData.banner_images
      : storeData?.banner
      ? [storeData.banner]
      : [];
    if (banners.length <= 1) return;
    const intervalSec = storeData?.banner_slide_interval ?? 3;
    const timer = setInterval(() => {
      setBannerSliding(true);
      setTimeout(() => {
        setBannerIndex(prev => (prev + 1) % banners.length);
        setBannerSliding(false);
      }, 600);
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [storeData?.banner_images, storeData?.banner, storeData?.banner_slide_interval]);

  // Derived state
  const isLoading = isStoreLoading || isProductsLoading;

  useEffect(() => {
    if (storeData) {
        console.log("Store loaded:", storeData);
    }
    if (productsData) {
        console.log("Products loaded:", productsData);
    }
  }, [storeData, productsData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {!isMobile && <Header />}
        <main className={`container mx-auto px-4 ${isMobile ? 'pb-20' : 'pb-8'}`}>
          <Skeleton className="h-80 mb-8" />
          <Skeleton className="h-60 mb-8" />
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  if (!storeData) {
    return (
      <div className="min-h-screen bg-gray-50">
        {!isMobile && <Header />}
        <main className={`container mx-auto px-4 py-12 text-center ${isMobile ? 'pb-20' : ''}`}>
          <h2 className="text-2xl font-bold text-gray-900">Tienda no encontrada</h2>
          <p className="text-gray-600 mt-2">No pudimos encontrar la tienda que buscas.</p>
          <Button onClick={() => navigate("/")} className="mt-4">Volver al inicio</Button>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  // Merge real data with mock defaults for missing fields
  const store = {
    ...storeData,
    rating: ratingData?.avg ?? null,
    reviews: ratingData?.count ?? null,
    followers: followersCount,
    productsCount: productsData?.total || 0,
    joinDate: new Date(storeData.created_at).toLocaleDateString(),
    location: (() => {
      const parts: string[] = [];
      if (storeData.communes?.name) parts.push(storeData.communes.name);
      if (storeData.departments?.name) parts.push(storeData.departments.name);
      if (storeData.country) parts.push(storeData.country);
      else if (storeData.city) parts.push(storeData.city);
      return parts.length > 0
        ? parts.join(", ")
        : COUNTRIES_MAP[storeData.metadata?.country] || "Haití";
    })(),
    responseTime: "Usually within 24h",
    categories: ["Ropa", "Accesorios", "Tecnología"], // Mock categories for now
    badges: storeData.is_active ? ["Verificado"] : [],
    social: {
      instagram: storeData.instagram,
      facebook: storeData.facebook,
      whatsapp: storeData.whatsapp,
      tiktok: storeData.tiktok,
    }
  };

  // Generate approx sales for last 24h (Mock logic for demo)
  // Use store ID to make it consistent but "random" looking
  const approxSales24h = Math.floor((store.id.charCodeAt(0) + new Date().getDate()) % 20) + 5;

  const products = productsData?.products || [];

  // Filter products
  const filteredProducts = products.filter((product: any) => {
    const matchSearch =
      !searchQuery ||
      product.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch;
  });

  const handleShare = async () => {
    const shareData = {
      title: store.name,
      text: `¡Visita ${store.name} en Siver Market Hub! ${store.description ? "- " + store.description : ""}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Enlace copiado",
          description: "El enlace de la tienda ha sido copiado al portapapeles.",
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "No se pudo copiar el enlace.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!isMobile && <Header />}

      <main className={`container mx-auto px-4 ${isMobile ? 'pb-20' : 'pb-0'}`}>
        {/* Store Profile Card — banner (7257×2079) covers entire card as background */}
        <div className="rounded-lg shadow-lg mt-4 relative z-10 mb-8 overflow-hidden">
          {/* Banner carousel as full-card background — slide right-to-left */}
          {(() => {
            const banners = storeData?.banner_images?.length
              ? storeData.banner_images
              : store.banner
              ? [store.banner]
              : [];
            return banners.length > 0 ? (
              <>
                {/* Sliding track: all banners side by side, translateX moves left */}
                <div
                  className="absolute inset-0 flex"
                  style={{
                    width: `${banners.length * 100}%`,
                    transform: `translateX(${bannerSliding
                      ? -((bannerIndex + 1) % banners.length) * (100 / banners.length)
                      : -(bannerIndex * (100 / banners.length))
                    }%)`,
                    transition: bannerSliding ? 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' : 'none',
                  }}
                >
                  {banners.map((url, i) => (
                    <div
                      key={i}
                      className="h-full bg-cover bg-center bg-no-repeat flex-shrink-0"
                      style={{
                        width: `${100 / banners.length}%`,
                        backgroundImage: `url(${url})`,
                      }}
                    />
                  ))}
                </div>
                {/* Dot indicators */}
                {banners.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                    {banners.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (i === bannerIndex) return;
                          setBannerSliding(true);
                          setTimeout(() => { setBannerIndex(i); setBannerSliding(false); }, 600);
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === bannerIndex ? 'bg-white scale-125' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-[#071d7f] to-blue-400" />
            );
          })()}
          {/* Dark scrim for readability */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Content — sits above the banner */}
          <div className="relative z-10 px-6 py-6">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-4">
              <div
                onClick={() => setShowProfileModal(true)}
                className="w-20 h-20 md:w-28 md:h-28 rounded-xl border-4 border-white/80 shadow-lg bg-white overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0"
              >
                {store.logo ? (
                  <img src={store.logo} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-[#071d7f]">{store.name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start md:gap-6">
              {/* Main Info */}
              <div className="flex-1 mb-4 md:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">
                    {store.name}
                  </h1>
                  {store.is_active && <CheckCircle className="w-6 h-6 text-white" />}
                </div>

                {/* Location + Ver Descripción */}
                <div className="flex items-center gap-3 mb-3">
                  {store.description && (
                    <Button
                      onClick={() => setShowProfileModal(true)}
                      variant="outline"
                      size="sm"
                      className="bg-white border-white text-[#071d7f] hover:bg-white/90 font-semibold"
                    >
                      Ver Descripción
                    </Button>
                  )}
                  {store.location && (
                    <div className="flex items-center gap-1 text-sm text-white/90">
                      <MapPin className="w-4 h-4 text-white/70 flex-shrink-0" />
                      <span className="font-medium text-white">{store.location}</span>
                    </div>
                  )}
                </div>

                {/* Badges + Store ID */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {store.badges.map((badge) => (
                    <span
                      key={badge}
                      className="bg-white text-[#071d7f] text-xs px-3 py-1 rounded-full font-semibold"
                    >
                      {badge}
                    </span>
                  ))}
                  {store.slug && (
                    <span className="text-xs text-[#071d7f] font-mono bg-white px-2 py-1 rounded select-all font-semibold">
                      {store.slug}
                    </span>
                  )}
                  {(totalSales30Days || 0) >= 1500 && (
                    <span className="bg-white text-[#071d7f] text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      ~{approxSales24h} ventas (24h)
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-wrap text-sm mb-3">
                  {/* Rating */}
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded">
                    <div className="flex text-yellow-400">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`w-4 h-4 ${store.rating !== null && i <= Math.round(store.rating!) ? 'fill-current' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    {store.rating !== null ? (
                      <>
                        <span className="font-semibold text-[#071d7f]">{store.rating}</span>
                        <span className="text-[#071d7f]/70">({store.reviews} reseñas)</span>
                      </>
                    ) : (
                      <span className="text-[#071d7f]/60 text-xs">Sin reseñas</span>
                    )}
                  </div>
                  {/* Productos */}
                  <div className="bg-white px-2 py-1 rounded text-[#071d7f]">
                    <span className="font-semibold text-[#071d7f]">{store.productsCount}</span> productos
                  </div>
                  {/* Seguidores */}
                  <div className="bg-white px-2 py-1 rounded text-[#071d7f]">
                    <span className="font-semibold text-[#071d7f]">{store.followers}</span> seguidores
                  </div>
                </div>

                {/* Social Media Links */}
                <div className="flex gap-3 mt-2">
                  {store.social.facebook && (
                    <a href={store.social.facebook} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
                      <Facebook className="h-5 w-5" />
                    </a>
                  )}
                  {store.social.instagram && (
                    <a href={store.social.instagram} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-pink-300 transition-colors">
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                  {store.social.whatsapp && (
                    <a href={`https://wa.me/${store.social.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-green-300 transition-colors">
                      <Phone className="h-5 w-5" />
                    </a>
                  )}
                  {store.social.tiktok && (
                    <a href={store.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
                      <Video className="h-5 w-5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <Button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className="w-full md:w-40 bg-white hover:bg-white/90 text-[#071d7f] font-semibold border-0"
                >
                  <Heart className={`w-4 h-4 mr-2 ${isFollowing ? "fill-red-500 text-red-500" : "text-[#071d7f]"}`} />
                  {isFollowing ? "Siguiendo" : "Seguir"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full md:w-40 bg-white border-white text-[#071d7f] hover:bg-white/90 font-semibold"
                >
                  <MessageCircle className="w-4 h-4 mr-2 text-[#071d7f]" />
                  Contactar
                </Button>
                <Button
                  variant="outline"
                  className="w-full md:w-40 bg-white border-white text-[#071d7f] hover:bg-white/90 font-semibold"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-2 text-[#071d7f]" />
                  Compartir
                </Button>
              </div>
            </div>

            {/* Payment Methods Section */}
            {storeData?.metadata && (
              <div className="mt-8 pt-8 border-t border-white/20">
                <PaymentMethodsDisplay
                  paymentData={storeData.metadata as PaymentMethodsData}
                  title="Métodos de Pago Aceptados"
                />
              </div>
            )}
          </div>
        </div>

        {/* Products Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Productos de {store.name}</h2>

          {/* Search & Filter */}
          <div className="bg-white rounded-lg p-4 mb-6 shadow">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar en esta tienda..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="md:w-48">
                <select
                  value={selectedCategory || ""}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas las categorías</option>
                  {store.categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filteredProducts.map((product: any) => {
              let images = product.images;
              if (typeof images === 'string') {
                try { images = JSON.parse(images); } catch { images = []; }
              }
              const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : '';

              const stock = product.stock ?? 0;
              const availabilityBadge = stock > 0 
                ? 'Disponible' 
                : (product.metadata?.disponible_pronto ? 'Disponible Pronto' : 'Agotado');

              const productForCard = {
                id: product.id,
                name: product.nombre,
                price: Number(product.precio_venta || 0),
                priceB2B: Number(product.precio_costo || product.precio_venta || 0),
                stock: stock,
                image: imageUrl,
                sku: product.sku,
                storeId: storeData?.id,
                storeName: storeData?.name,
                storeWhatsapp: storeData?.whatsapp,
                isSellerVerified: storeData?.is_active || false,
                source_product_id: product.source_product_id,
                badge: availabilityBadge,
              };

              return <ProductCard key={product.id} product={productForCard} />;
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No se encontraron productos</p>
            </div>
          )}
        </div>

        {/* Store Footer / Social Links */}
        <div className="bg-white border-t border-gray-200 py-12 mt-12 rounded-lg shadow-sm">
            <div className="container mx-auto px-4 text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Sigue a {store.name}</h3>
                <div className="flex justify-center gap-8 mb-8">
                    {store.social.facebook && (
                        <a href={store.social.facebook} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors group">
                            <div className="p-3 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                                <Facebook className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-medium">Facebook</span>
                        </a>
                    )}
                    {store.social.instagram && (
                        <a href={store.social.instagram} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-gray-500 hover:text-pink-600 transition-colors group">
                            <div className="p-3 bg-gray-100 rounded-full group-hover:bg-pink-100 transition-colors">
                                <Instagram className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-medium">Instagram</span>
                        </a>
                    )}
                    {store.social.whatsapp && (
                        <a href={`https://wa.me/${store.social.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-gray-500 hover:text-green-600 transition-colors group">
                            <div className="p-3 bg-gray-100 rounded-full group-hover:bg-green-100 transition-colors">
                                <Phone className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-medium">WhatsApp</span>
                        </a>
                    )}
                    {store.social.tiktok && (
                        <a href={store.social.tiktok} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-gray-500 hover:text-black transition-colors group">
                            <div className="p-3 bg-gray-100 rounded-full group-hover:bg-gray-200 transition-colors">
                                <Video className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-medium">TikTok</span>
                        </a>
                    )}
                </div>
                <p className="text-gray-500 text-sm">
                     {new Date().getFullYear()} {store.name}. Todos los derechos reservados.
                </p>
            </div>
        </div>

      </main>

      {/* Profile Photo Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Photo Section */}
            <div className="flex justify-center">
              {store.logo ? (
                <img
                  src={store.logo}
                  alt={store.name}
                  className="max-h-96 rounded-lg shadow-lg object-cover"
                />
              ) : (
                <div className="w-80 h-80 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-6xl font-bold text-gray-400">{store.name.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Store Description */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📝 Descripción de la Tienda</span>
              </h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                {store.description || "No hay descripción configurada para esta tienda."}
              </p>
            </div>

            {/* Store Info Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-500 font-medium">Miembro desde</p>
                <p className="text-gray-900 font-semibold">{store.joinDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Ubicación</p>
                <p className="text-gray-900 font-semibold flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {store.location}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Tiempo de respuesta</p>
                <p className="text-gray-900 font-semibold flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {store.responseTime}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Tasa de envío</p>
                <p className="text-gray-900 font-semibold flex items-center gap-1">
                  <ShoppingBag className="h-4 w-4" />
                  99.8%
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!isMobile && <Footer />}
    </div>
  );
};

export default StoreProfilePage;
