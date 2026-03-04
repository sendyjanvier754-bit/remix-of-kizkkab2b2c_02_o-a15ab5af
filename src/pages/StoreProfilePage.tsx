import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useStore, useStoreProducts, useStoreSales } from "@/hooks/useStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { PaymentMethodsDisplay, PaymentMethodsData } from "@/components/shared/PaymentMethodsDisplay";
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
  const { role } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch real store data
  const { data: storeData, isLoading: isStoreLoading } = useStore(storeId);
  const { data: productsData, isLoading: isProductsLoading } = useStoreProducts(storeId);
  const { data: totalSales30Days } = useStoreSales(storeId);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);

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
    rating: 4.8,
    reviews: 150,
    followers: 342,
    productsCount: productsData?.total || 0,
    joinDate: new Date(storeData.created_at).toLocaleDateString(),
    location: storeData.city && storeData.country 
      ? `${storeData.city}, ${storeData.country}` 
      : storeData.country || COUNTRIES_MAP[storeData.metadata?.country] || "Haití",
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
        {/* Banner - Compact */}
        <div className="relative h-24 md:h-32 bg-gray-200 rounded-b-lg overflow-hidden -mx-4 mb-0">
          {store.banner ? (
            <img
              src={store.banner}
              alt={store.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-900 to-blue-600 flex items-center justify-center">
                <ShoppingBag className="h-16 w-16 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        </div>

        {/* Store Profile Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 -mt-24 relative z-10 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:gap-6">
            {/* Logo & Main Info */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 mb-4 md:mb-0">
              {/* Logo */}
              <div 
                onClick={() => setShowProfileModal(true)}
                className="w-24 h-24 md:w-32 md:h-32 rounded-lg border-4 border-white shadow-lg bg-white overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
              >
                  {store.logo ? (
                    <img
                        src={store.logo}
                        alt={store.name}
                        className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-gray-300">{store.name.substring(0, 2).toUpperCase()}</span>
                  )}
              </div>

              {/* Basic Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {store.name}
                  </h1>
                  {store.is_active && <CheckCircle className="w-6 h-6 text-blue-600" />}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {store.badges.map((badge) => (
                    <span
                      key={badge}
                      className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold"
                    >
                      {badge}
                    </span>
                  ))}
                  {(totalSales30Days || 0) >= 1500 && (
                    <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        ~{approxSales24h} ventas (24h)
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-wrap text-sm mb-3">
                  <div className="flex items-center gap-1">
                    <div className="flex text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <span className="font-semibold text-gray-900">{store.rating}</span>
                    <span className="text-gray-600">({store.reviews})</span>
                  </div>
                  <div className="text-gray-600">
                    <span className="font-semibold">{store.followers}</span>{" "}
                    seguidores
                  </div>
                  <div className="text-gray-600">
                    <span className="font-semibold">{store.productsCount}</span> productos
                  </div>
                </div>

                {/* Social Media Links (Top) */}
                <div className="flex gap-3 mt-2">
                    {store.social.facebook && (
                        <a href={store.social.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                            <Facebook className="h-5 w-5" />
                        </a>
                    )}
                    {store.social.instagram && (
                        <a href={store.social.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-600 transition-colors">
                            <Instagram className="h-5 w-5" />
                        </a>
                    )}
                    {store.social.whatsapp && (
                        <a href={`https://wa.me/${store.social.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600 transition-colors">
                            <Phone className="h-5 w-5" />
                        </a>
                    )}
                    {store.social.tiktok && (
                        <a href={store.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                            <Video className="h-5 w-5" />
                        </a>
                    )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Button className="w-full md:w-40 bg-blue-600 hover:bg-blue-700 text-white">
                <Heart className="w-4 h-4 mr-2" />
                Seguir
              </Button>
              <Button
                variant="outline"
                className="w-full md:w-40 border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contactar
              </Button>
              <Button
                variant="outline"
                className="w-full md:w-40 border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={handleShare}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Compartir
              </Button>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Ubicación</p>
                <p className="font-semibold text-gray-900">{store.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Tiempo de respuesta</p>
                <p className="font-semibold text-gray-900">{store.responseTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Se unió</p>
                <p className="font-semibold text-gray-900">{store.joinDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Tasa de envío</p>
                <p className="font-semibold text-gray-900">99.8%</p>
              </div>
            </div>
          </div>

          {/* Description Button */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <Button 
              onClick={() => setShowProfileModal(true)}
              variant="outline"
              className="w-full md:w-auto border-gray-300 text-[#071d7f] hover:bg-blue-50"
            >
              Ver Descripción
            </Button>
          </div>

          {/* Payment Methods Section - from store metadata */}
          {storeData?.metadata && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <PaymentMethodsDisplay 
                paymentData={storeData.metadata as PaymentMethodsData}
                title="Métodos de Pago Aceptados"
              />
            </div>
          )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product: any) => {
              // Handle images which might be JSONB array or string array
              let imageUrl = null;
              let images = product.images;

              // Safe parsing for JSONB
              if (typeof images === 'string') {
                try {
                    images = JSON.parse(images);
                } catch (e) {
                    console.error("Error parsing images for product", product.id, e);
                    images = [];
                }
              }

              if (Array.isArray(images) && images.length > 0) {
                  imageUrl = images[0];
              }

              const outOfStock = (product.stock ?? 0) === 0;
              const disponiblePronto = product.metadata?.disponible_pronto === true;

              return (
              <div
                key={product.id}
                className="bg-white rounded-lg overflow-hidden hover:shadow-xl transition duration-300 cursor-pointer"
                onClick={() => navigate(`/producto/${product.sku}`)}
              >
                {/* Image */}
                <div className="relative h-56 bg-gray-100 overflow-hidden group">
                  {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.nombre}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                        loading="lazy"
                      />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                          <ShoppingBag className="h-12 w-12" />
                      </div>
                  )}
                  {/* Stock / availability badge */}
                  {disponiblePronto ? (
                    <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      Disponible Pronto
                    </span>
                  ) : outOfStock ? (
                    <span className="absolute top-2 left-2 bg-gray-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      Agotado
                    </span>
                  ) : (
                    <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      En Stock
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-2">
                    {product.nombre}
                  </h3>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-bold text-gray-900">
                      ${Number(product.precio_venta || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Stock count (only when in stock) */}
                  {!outOfStock && !disponiblePronto && (
                    <p className="text-xs text-green-600 font-medium mb-2">
                      {product.stock} disponible{product.stock !== 1 ? 's' : ''}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 space-y-2">
                    {(role === UserRole.ADMIN || role === UserRole.SELLER) ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/producto/${product.sku}`);
                        }}
                        className="w-full bg-green-600 text-white hover:bg-green-700"
                        disabled={outOfStock && !disponiblePronto}
                      >
                        Vender (Agregar al Carrito)
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/producto/${product.sku}`);
                        }}
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
                        disabled={outOfStock && !disponiblePronto}
                      >
                        {outOfStock && !disponiblePronto ? "Sin Stock" : "Ver Detalles"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )})}
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!isMobile && <Footer />}
    </div>
  );
};

export default StoreProfilePage;
