import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from '@/types/auth';
import { useCart } from "@/hooks/useCart";
import { useCartB2B } from "@/hooks/useCartB2B";
import { useWishlist } from "@/hooks/useWishlist";
import { useToast } from '@/hooks/use-toast';
import { useStore } from '@/hooks/useStore';
import { useIsMobile } from "@/hooks/use-mobile";
import { useProductVariants } from "@/hooks/useProductVariants";
import { useRecommendedProducts } from "@/hooks/useMarketplaceData";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import VariantSelector from "@/components/products/VariantSelector";
import VariantDrawer from '@/components/products/VariantDrawer';
import useVariantDrawerStore from '@/stores/useVariantDrawerStore';
import ProductReviews from "@/components/products/ProductReviews";
import ProductCarousel from "@/components/landing/ProductCarousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronRight, ChevronLeft, ShoppingCart, Heart, Store as StoreIcon, Package, TrendingUp, Calculator, Shield, Truck, RotateCcw, Award, MessageCircle, Zap, Info, Star, X, ArrowLeft, Search, Share2, MoreVertical, ZoomIn } from "lucide-react";

// Hook to fetch product from both seller_catalog and products table by SKU or catalog ID
const useProductBySku = (sku: string | undefined, catalogId: string | undefined) => {
  return useQuery({
    queryKey: ["product-by-sku", sku, catalogId],
    queryFn: async () => {
      // If catalogId is provided, search directly in seller_catalog by ID
      if (catalogId) {
        const {
          data: sellerProduct,
          error: sellerError
        } = await supabase.from("seller_catalog").select(`
            *,
            store:stores!seller_catalog_seller_store_id_fkey(
              id, name, logo, whatsapp, is_active
            ),
            source_product:products!seller_catalog_source_product_id_fkey(
              id, categoria_id, precio_mayorista, precio_sugerido_venta, moq, stock_fisico, galeria_imagenes,
              category:categories!products_categoria_id_fkey(id, name, slug)
            )
          `).eq("id", catalogId).eq("is_active", true).maybeSingle();
        
        if (sellerProduct) {
          return {
            type: 'seller_catalog' as const,
            id: sellerProduct.id,
            sku: sellerProduct.sku,
            nombre: sellerProduct.nombre,
            descripcion: sellerProduct.descripcion,
            precio_venta: sellerProduct.precio_venta,
            precio_costo: sellerProduct.precio_costo,
            stock: sellerProduct.stock,
            images: sellerProduct.images || sellerProduct.source_product?.galeria_imagenes || [],
            store: sellerProduct.store,
            source_product: sellerProduct.source_product
          };
        }
      }

      // Otherwise search by SKU
      if (!sku) return null;

      // Clean up SKU if it has -undefined suffix
      const cleanSku = sku.replace(/-undefined$/, '');

      // First try to find in seller_catalog (B2C)
      const {
        data: sellerProduct,
        error: sellerError
      } = await supabase.from("seller_catalog").select(`
          *,
          store:stores!seller_catalog_seller_store_id_fkey(
            id, name, logo, whatsapp, is_active
          ),
          source_product:products!seller_catalog_source_product_id_fkey(
            id, categoria_id, precio_mayorista, precio_sugerido_venta, moq, stock_fisico, galeria_imagenes,
            category:categories!products_categoria_id_fkey(id, name, slug)
          )
        `).eq("sku", cleanSku).eq("is_active", true).maybeSingle();
      if (sellerProduct) {
        return {
          type: 'seller_catalog' as const,
          id: sellerProduct.id,
          sku: sellerProduct.sku,
          nombre: sellerProduct.nombre,
          descripcion: sellerProduct.descripcion,
          precio_venta: sellerProduct.precio_venta,
          precio_costo: sellerProduct.precio_costo,
          stock: sellerProduct.stock,
          images: sellerProduct.images || sellerProduct.source_product?.galeria_imagenes || [],
          store: sellerProduct.store,
          source_product: sellerProduct.source_product
        };
      }

      // If not found in seller_catalog, try products table (B2B)
      const {
        data: b2bProduct,
        error: b2bError
      } = await supabase.from("v_productos_con_precio_b2b").select("*").eq("sku_interno", cleanSku).eq("is_active", true).maybeSingle();
      if (b2bProduct) {
        return {
          type: 'products' as const,
          id: b2bProduct.id,
          sku: b2bProduct.sku_interno,
          nombre: b2bProduct.nombre,
          descripcion: b2bProduct.descripcion_larga || b2bProduct.descripcion_corta,
          precio_venta: b2bProduct.precio_b2b,
          precio_costo: b2bProduct.costo_base_excel,
          stock: b2bProduct.stock_fisico,
          images: b2bProduct.galeria_imagenes || (b2bProduct.imagen_principal ? [b2bProduct.imagen_principal] : []),
          store: null,
          source_product: {
            id: b2bProduct.id,
            categoria_id: b2bProduct.categoria_id,
            precio_mayorista: b2bProduct.costo_base_excel,
            precio_sugerido_venta: b2bProduct.precio_b2b,
            moq: b2bProduct.moq,
            stock_fisico: b2bProduct.stock_fisico,
            category: b2bProduct.category
          }
        };
      }
      console.error("Product not found for SKU:", sku);
      return null;
    },
    enabled: !!sku
  });
};
const ProductPage = () => {
  // Sticky nav state
  const [showStickyNav, setShowStickyNav] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [showFloatingCart, setShowFloatingCart] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const recsRef = useRef<HTMLDivElement>(null);
  const buySection = useRef<HTMLDivElement>(null);
  const buyButtonRef = useRef<HTMLButtonElement>(null);

  // Get isMobile hook early (needed for useEffect)
  const isMobile = useIsMobile();

  // Detect scroll to buy section and past image - consolidated handler
  useEffect(() => {
    const handleScroll = () => {
      let shouldShow = false;

      // Check if buy section is visible
      if (buySection.current) {
        const buyRect = buySection.current.getBoundingClientRect();
        shouldShow = buyRect.top <= 500;
      }

      // Also check if scrolled past image
      if (imageRef.current) {
        const imageRect = imageRef.current.getBoundingClientRect();
        shouldShow = shouldShow || imageRect.bottom <= 64;
      }

      setShowCompactHeader(shouldShow);
      setShowStickyNav(shouldShow);

      // Detect if buy button is scrolled above view (show floating cart when button disappears up)
      if (buyButtonRef.current && isMobile) {
        const buttonRect = buyButtonRef.current.getBoundingClientRect();
        setShowFloatingCart(buttonRect.bottom < 0);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  // Scroll to section
  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      const offset = isMobile ? 72 : 64;
      const top = ref.current.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({
        top,
        behavior: 'smooth'
      });
    }
  };
  const {
    sku,
    catalogId
  } = useParams();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  // Determine if user is B2B (Seller)
  const isB2BUser = user?.role === UserRole.SELLER;

  // Use the correct wishlist hook based on user type
  const { isInWishlist, toggleWishlist } = useWishlist();

  // Fetch product data from both tables
  const {
    data: product,
    isLoading
  } = useProductBySku(sku, catalogId);
  // Load store profile when product comes from a seller catalog (used to determine currency)
  const {
    data: storeData
  } = useStore((product as any)?.store?.id);

  // Fetch recommended products based on current product's category
  const categoryId = product?.source_product?.categoria_id || null;
  const { data: recommendedProducts = [], isLoading: loadingRecommended } = useRecommendedProducts(
    product?.id || null,
    categoryId,
    8
  );

  // ✅ Fetch product variants with B2B prices if user is seller
  const { data: variants = [] } = useProductVariants(product?.source_product?.id, isB2BUser);

  // Local state
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [viewTracked, setViewTracked] = useState(false);
  // Title collapse/expand
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [showTitleToggle, setShowTitleToggle] = useState(false);
  // Image zoom
  const [zoomOpen, setZoomOpen] = useState(false);
  // Dynamic pricing for B2B
  const [dynamicPrice, setDynamicPrice] = useState<number | null>(null);

  // Determine if title is long enough to show toggle
  useEffect(() => {
    setShowTitleToggle(Boolean(product && product.nombre && product.nombre.length > 60));
  }, [product]);

  // Variations state
  type Variation = {
    id: string;
    label: string;
    stock?: number;
    quantity: number;
  };
  const [variations, setVariations] = useState<Variation[]>([]);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [isDescriptionDrawerOpen, setIsDescriptionDrawerOpen] = useState(false);

  // Derive variations from product fields (flexible: soporta varias estructuras)
  useEffect(() => {
    if (!product) return;

    // Prefer explicit 'variantes' / 'variations' field
    const raw: any = (product as any).variantes || (product as any).variations || (product as any).options;
    if (Array.isArray(raw) && raw.length > 0) {
      setVariations(raw.map((v: any, idx: number) => ({
        id: v.id || String(idx),
        label: v.label || v.nombre || v,
        stock: v.stock || v.stock_fisico || undefined,
        quantity: 0
      })));
      return;
    }

    // Try colores / tallas combinations
    const colores: string[] = (product as any).colores || (product as any).colors || [];
    const tallas: string[] = (product as any).tallas || (product as any).sizes || [];
    if (colores.length > 0 && tallas.length > 0) {
      const combos: Variation[] = [];
      colores.forEach((c, ci) => {
        tallas.forEach((t, ti) => {
          combos.push({
            id: `${ci}-${ti}`,
            label: `${c} / ${t}`,
            quantity: 0
          });
        });
      });
      setVariations(combos);
      return;
    }
    if (colores.length > 0) {
      setVariations(colores.map((c, i) => ({
        id: `c-${i}`,
        label: String(c),
        quantity: 0
      })));
      return;
    }
    if (tallas.length > 0) {
      setVariations(tallas.map((s, i) => ({
        id: `s-${i}`,
        label: String(s),
        quantity: 0
      })));
      return;
    }

    // Fallback: single default variation
    setVariations([{
      id: product.id || 'default',
      label: 'Default',
      quantity: 0,
      stock: product.stock || product.source_product && product.source_product.stock_fisico || undefined
    }]);
  }, [product]);
  const totalSelectedQty = variations.reduce((sum, v) => sum + (v.quantity || 0), 0);
  // Guard accesses to 'product' to avoid runtime errors when product is undefined
  const currentMoq = product?.source_product?.moq || (product as any)?.moq || 1;
  const updateVariationQty = (id: string, newQty: number) => {
    setVariations(prev => prev.map(v => v.id === id ? {
      ...v,
      quantity: Math.max(0, newQty)
    } : v));
  };
  const handleOpenPurchase = () => {
    // If B2B enforce MOQ sum
    if (isB2BUser && totalSelectedQty > 0 && totalSelectedQty < currentMoq) {
      toast({
        title: 'Cantidad mínima',
        description: `El pedido total debe ser al menos ${currentMoq} unidades.`,
        className: 'bg-yellow-100'
      });
      return;
    }
    // Open bottom sheet with selected variations
    setShowBottomSheet(true);
  };

  // Tabs state for Description / Reviews / Recs
  const [activeTab, setActiveTab] = useState<'desc' | 'reviews' | 'recs'>('desc');

  // Keyboard navigation for tabs
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      setActiveTab(prev => prev === 'desc' ? 'reviews' : prev === 'reviews' ? 'recs' : 'desc');
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      setActiveTab(prev => prev === 'recs' ? 'reviews' : prev === 'reviews' ? 'desc' : 'recs');
    }
  };

  // IntersectionObserver to update active tab on scroll
  useEffect(() => {
    const mapping: {
      ref: React.RefObject<HTMLDivElement>;
      id: 'desc' | 'reviews' | 'recs';
    }[] = [{
      ref: descRef,
      id: 'desc'
    }, {
      ref: reviewsRef,
      id: 'reviews'
    }, {
      ref: recsRef,
      id: 'recs'
    }];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const found = mapping.find(m => m.ref.current === entry.target);
          if (found) setActiveTab(found.id);
        }
      });
    }, {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0
    });
    mapping.forEach(m => {
      if (m.ref.current) observer.observe(m.ref.current);
    });
    return () => observer.disconnect();
  }, [descRef, reviewsRef, recsRef]);

  // Cart hooks
  const {
    addItem: addItemB2C
  } = useCart();
  const {
    addItem: addItemB2B
  } = useCartB2B();

  // Derived data
  const images = useMemo(() => {
    if (!product) return [];
    const imgs = product.images as any;
    // Filter out empty strings and invalid URLs
    const validImages = Array.isArray(imgs) ? imgs.filter((img: string) => img && img.trim() !== '') : [];
    return validImages.length > 0 ? validImages : [];
  }, [product]);

  // B2B Specific Data
  const costB2B = product?.source_product?.precio_mayorista || 0;
  const pvp = product?.precio_venta || 0;
  const moq = product?.source_product?.moq || 1;
  const stockB2B = product?.source_product?.stock_fisico || 0;

  // Limits
  const minQuantity = isB2BUser ? moq : 1;
  const maxQuantity = isB2BUser ? stockB2B : product?.stock || 0;

  // Initialize quantity with MOQ for B2B
  useEffect(() => {
    if (isB2BUser && moq > 1) {
      setQuantity(moq);
    }
  }, [isB2BUser, moq]);

  // Business Logic for B2B
  const businessSummary = useMemo(() => {
    if (!isB2BUser || !product) return null;
    // Usar precio de la vista v_productos_con_precio_b2b
    const priceToUse = product.precio_venta || pvp;
    const investment = costB2B * quantity;
    const estimatedRevenue = priceToUse * quantity;
    const estimatedProfit = estimatedRevenue - investment;
    const profitPercentage = costB2B > 0 ? (priceToUse - costB2B) / costB2B * 100 : 0;
    const profitPerUnit = priceToUse - costB2B;
    return {
      investment,
      estimatedRevenue,
      estimatedProfit,
      profitPercentage: profitPercentage.toFixed(1),
      profitPerUnit
    };
  }, [isB2BUser, product, quantity, costB2B, pvp]);

  // Related Products Logic (simplified without allProducts)
  const relatedProducts: any[] = [];

  // Track view
  useEffect(() => {
    if (product && !viewTracked) {
      // trackView(product.id, "product_page"); // Assuming trackView exists or will be implemented
      setViewTracked(true);
    }
    // Decide whether to show the "Mostrar más" toggle for long titles (>60 chars)
    if (product && product.nombre) {
      setShowTitleToggle(product.nombre.length > 60);
    }
  }, [product, viewTracked]);

  // DEBUG: log when product loads so developer can confirm updated bundle is used
  useEffect(() => {
    if (product) {
      // eslint-disable-next-line no-console
      console.log('[ProductPage] loaded product:', product.nombre, 'length:', product.nombre?.length);
    }
  }, [product]);
  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(minQuantity, Math.min(maxQuantity, newQty));
    setQuantity(validQty);
  };
  const handleAddToCart = () => {
    if (!product) return;
    
    // Add directly to cart
    if (isB2BUser) {
      const priceToAdd = product.precio_venta || costB2B;
      addItemB2B({
        productId: product.source_product?.id || product.id,
        nombre: product.nombre,
        precio_b2b: priceToAdd,
        moq: moq,
        stock_fisico: stockB2B,
        sku: product.sku,
        imagen_principal: images[0] || '',
        cantidad: quantity,
        subtotal: priceToAdd * quantity
      });
      toast({
        title: "Agregado al pedido B2B",
        description: `${quantity} unidades de ${product.nombre}`,
        className: "bg-blue-600 text-white border-none"
      });
    } else {
      for (let i = 0; i < quantity; i++) {
        addItemB2C({
          id: product.id,
          name: product.nombre,
          price: product.precio_venta,
          image: images[0] || '',
          sku: product.sku,
          storeId: product.store?.id,
          storeName: product.store?.name,
          storeWhatsapp: product.store?.whatsapp || undefined
        });
      }
      toast({
        title: "Producto agregado",
        description: `${product.nombre} (x${quantity}) se agregó al carrito`
      });
    }
  };

  // Quick-add: add selected variations (if any) or current quantity directly to cart
  const handleQuickAdd = () => {
    if (!product) return;

    // If there are variations selected, add them
    if (variations.length > 0 && totalSelectedQty > 0) {
      // Enforce MOQ for B2B
      if (isB2BUser && totalSelectedQty < currentMoq) {
        toast({
          title: 'Cantidad mínima',
          description: `El pedido total debe ser al menos ${currentMoq} unidades.`,
          className: 'bg-yellow-100'
        });
        return;
      }
      variations.forEach(v => {
        const qty = v.quantity || 0;
        if (qty <= 0) return;
        if (isB2BUser) {
          const priceToAdd = product.precio_venta || costB2B;
          addItemB2B({
            productId: product.source_product?.id || product.id,
            nombre: product.nombre,
            precio_b2b: priceToAdd,
            moq: moq,
            stock_fisico: stockB2B,
            sku: product.sku,
            imagen_principal: images[0] || '',
            cantidad: qty,
            subtotal: priceToAdd * qty
          });
        } else {
          for (let i = 0; i < qty; i++) {
            addItemB2C({
              id: product.id,
              name: product.nombre,
              price: product.precio_venta,
              image: images[0] || '',
              sku: product.sku,
              storeId: product.store?.id,
              storeName: product.store?.name,
              storeWhatsapp: product.store?.whatsapp || undefined
            });
          }
        }
      });
      toast({
        title: isB2BUser ? 'Agregado al pedido B2B' : 'Producto agregado',
        description: `${product.nombre} (x${totalSelectedQty})`
      });
      return;
    }

    // Fallback: use single quantity selector
    handleAddToCart();
  };
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {!isMobile && <GlobalHeader />}
        <main className={`container mx-auto px-4 py-8 ${isMobile ? 'pb-32' : 'pb-8'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-12 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Package className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Producto no encontrado</h2>
        <Button onClick={() => navigate("/")} className="mt-4">Volver al inicio</Button>
      </div>
    );
  }

  // Usar precio de v_productos_con_precio_b2b (ya viene en product.precio_venta)
  const displayPrice = isB2BUser ? product.precio_venta : product.precio_venta;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Mobile Header Hide - Apply to body via style */}
      {isMobile && showCompactHeader && (
        <style>{`header { display: none !important; }`}</style>
      )}

      {/* Desktop Header */}
      {!isMobile && <GlobalHeader />}

      {/* Mobile Header - Hidden when compact header shows */}
      {isMobile && !showCompactHeader && <GlobalHeader />}

      {/* tabsstickyHeader - Compact Header + Sticky Tabs (Mobile) */}
      {isMobile && showCompactHeader && (
        <div className="sticky top-0 z-50">
          {/* Compact Search Header */}
          <div className="bg-[#071d7f] border-b border-gray-300 px-3 py-1.5 flex items-center justify-between gap-2">
            <button onClick={() => navigate(-1)} className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            
            {/* Search Bar with Product Name */}
            <div className="flex-1 min-w-0 bg-white/20 rounded-full px-3 py-1 flex items-center gap-2">
              <Search className="w-4 h-4 text-white/70 flex-shrink-0" />
              <input
                type="text"
                placeholder={product?.nombre || "Buscar..."}
                defaultValue={product?.nombre || ""}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/60 outline-none"
                readOnly
              />
            </div>

            <button 
              onClick={() => {
                if (product) {
                  toggleWishlist({
                    productId: isB2BUser ? product.id : undefined,
                    sellerCatalogId: !isB2BUser ? product.id : undefined,
                    storeId: product.store?.id,
                    type: isB2BUser ? 'B2B' : 'B2C',
                  });
                }
              }}
              className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded"
            >
              <Heart className={`w-5 h-5 ${product && (isB2BUser ? isInWishlist(product.id) : isInWishlist(undefined, product.id)) ? 'fill-red-400 text-red-400' : 'text-white'}`} />
            </button>

            <button className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded">
              <Share2 className="w-5 h-5 text-white" />
            </button>

            <button className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded">
              <MoreVertical className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Sticky Tabs */}
          <div role="tablist" aria-label="Product sections mobile" className="bg-white border-b py-2 shadow-sm animate-fade-in px-4 flex gap-1 flex-wrap justify-center">
            <div className="w-auto rounded-md border border-[#071d7f] bg-white px-2 py-1 flex gap-1 flex-nowrap items-center justify-start">
              <button id="tab-desc-mobile" role="tab" aria-selected={activeTab === 'desc'} aria-controls="section-desc" tabIndex={activeTab === 'desc' ? 0 : -1} onClick={() => {
                setActiveTab('desc');
                scrollToSection(descRef);
              }} onKeyDown={handleTabKeyDown} className={`px-2 py-0.5 text-xs font-semibold ${activeTab === 'desc' ? 'bg-[#071d7f] text-white rounded-full shadow-sm' : 'bg-white border border-blue-100 text-[#071d7f] rounded-md'}`}>
                Descripción
              </button>

              <button id="tab-reviews-mobile" role="tab" aria-selected={activeTab === 'reviews'} aria-controls="section-reviews" tabIndex={activeTab === 'reviews' ? 0 : -1} onClick={() => {
                setActiveTab('reviews');
                scrollToSection(reviewsRef);
              }} onKeyDown={handleTabKeyDown} className={`px-2 py-0.5 text-xs font-semibold ${activeTab === 'reviews' ? 'bg-[#071d7f] text-white rounded-full shadow-sm' : 'bg-white border border-blue-100 text-[#071d7f] rounded-md'}`}>
                Valoraciones
              </button>

              <button id="tab-recs-mobile" role="tab" aria-selected={activeTab === 'recs'} aria-controls="section-recs" tabIndex={activeTab === 'recs' ? 0 : -1} onClick={() => {
                setActiveTab('recs');
                scrollToSection(recsRef);
              }} onKeyDown={handleTabKeyDown} className={`px-2 py-0.5 text-xs font-semibold ${activeTab === 'recs' ? 'bg-[#071d7f] text-white rounded-full shadow-sm' : 'bg-white border border-blue-100 text-[#071d7f] rounded-md'}`}>
                Recomendados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Nav Tabs: reemplaza la barra de categorías */}
      {/* REMOVED: Desktop sticky nav replaced with Accordion component */}

      <main className={`container mx-auto ${isMobile ? 'px-0 pb-12' : 'px-4 pb-12'} py-4`}>
        {/* Breadcrumb / Retorno Button - Desktop */}
        {!isMobile && (
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#071d7f] hover:text-[#0a2a9f] mb-6 md:mt-16 group transition-all"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">Volver</span>
          </button>
        )}

        <div className={`${isMobile ? 'grid grid-cols-1 gap-4 mb-8 px-4' : 'grid grid-cols-2 gap-8 mb-8'}`}>
          {/* Image Gallery */}
          <div ref={imageRef} className={`space-y-4 ${isMobile ? 'w-full' : 'sticky top-0 h-fit'}`}>
            <div 
              onClick={() => !isMobile && setZoomOpen(true)}
              className={`relative bg-white overflow-hidden shadow-sm border-gray-100 cursor-zoom-in ${isMobile ? 'w-full aspect-[4/5] rounded-none border-y' : 'rounded-2xl aspect-square border'}`}
            >
              {images.length > 0 ? (
                <img 
                  src={images[selectedImage]} 
                  alt={product.nombre} 
                  className={`w-full h-full ${isMobile ? 'object-cover' : 'object-contain p-4'}`}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <Package className="h-20 w-20 text-gray-300" />
                </div>
              )}

              {/* Navigation Arrows */}
              {images.length > 1 && <>
                  <button onClick={e => {
                e.stopPropagation();
                setSelectedImage(prev => prev === 0 ? images.length - 1 : prev - 1);
              }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 shadow-md rounded-full p-2 hover:bg-white">
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button onClick={e => {
                e.stopPropagation();
                setSelectedImage(prev => prev === images.length - 1 ? 0 : prev + 1);
              }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 shadow-md rounded-full p-2 hover:bg-white">
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </>}

              {/* B2B Profit Badge Overlay */}
              {isB2BUser && businessSummary && businessSummary.profitPerUnit > 0 && <div className="absolute top-4 left-4 animate-blink">
                  <Badge className="bg-green-600 hover:bg-green-700 text-white border-none px-3 py-1.5 shadow-lg flex gap-1.5 items-center text-sm">
                    <TrendingUp className="w-4 h-4" />
                    Ganas ${businessSummary.profitPerUnit.toFixed(2)}/u
                  </Badge>
                </div>}
              
              <button 
                onClick={() => {
                  if (product?.id) {
                    toggleWishlist({ 
                      productId: isB2BUser ? product.id : undefined,
                      sellerCatalogId: !isB2BUser ? product.id : undefined,
                      storeId: (product as any)?.store?.id,
                      type: isB2BUser ? 'B2B' : 'B2C',
                    });
                  }
                }}
                className="absolute top-4 right-4 bg-white/80 hover:bg-white rounded-full p-2 shadow-sm transition"
              >
                <Heart 
                  className={`w-5 h-5 transition-colors ${
                    product?.id && (isB2BUser ? isInWishlist(product.id) : isInWishlist(undefined, product.id))
                      ? 'text-red-500 fill-red-500' 
                      : 'text-gray-400 hover:text-red-500'
                  }`} 
                />
              </button>
            </div>

            {/* Thumbnails for Desktop */}
            {!isMobile && images.length > 1 && <div className="flex gap-3 overflow-x-auto pb-2 px-1">
                {images.map((image, index) => (
                  <button key={index} onClick={() => setSelectedImage(index)} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === index ? "border-blue-600 ring-2 ring-blue-100" : "border-transparent bg-white"}`}>
                    <img src={image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                  </button>
                ))}
              </div>}

            {/* Color Variants Grid for Mobile */}
            {isMobile && images.length > 0 && (
              <div className="px-4 py-4 bg-white border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Colores disponibles</h4>
                <div className="flex flex-wrap gap-3 justify-start">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`relative overflow-hidden rounded-full border-2 transition-all w-14 h-14 hover:border-gray-400 flex-shrink-0 ${
                        selectedImage === index
                          ? 'border-blue-600 ring-2 ring-blue-100'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      title={`Color ${index + 1}`}
                    >
                      <img 
                        src={image} 
                        alt={`Color ${index + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                      />
                      {selectedImage === index && (
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Product Info */}
          <div className={`space-y-3 ${isMobile ? 'px-4 w-full' : 'overflow-y-auto max-h-[calc(100vh-200px)] pr-4'}`}> 
            <div>
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {isB2BUser ? <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                    Mayorista
                  </Badge> : <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                    Nuevo
                  </Badge>}
                {product.store && <Link to={`/tienda/${product.store.id}`} className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors">
                    <StoreIcon className="w-3 h-3" />
                    {product.store.name}
                    <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-purple-200">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">5.0</span>
                    </div>
                  </Link>}
              </div>

              <div className="flex flex-col gap-2">
                <h1 className={`text-lg md:text-xl font-semibold text-gray-900 leading-tight mb-0`}>
                  {titleExpanded ? <div className="flex items-start gap-2">
                      <div className="whitespace-normal">{product.nombre}</div>
                      {showTitleToggle && <button onClick={() => setTitleExpanded(false)} className="ml-2 text-xs font-semibold px-2 py-1 rounded border border-[#071d7f] text-[#071d7f] pulse-btn bg-white z-10" aria-expanded={true} aria-label="Collapse product title">
                          View less
                        </button>}
                    </div> : <div className="flex items-baseline gap-1">
                      <div className="flex-1 line-clamp-2 break-words">
                        {product.nombre}
                      </div>
                      {showTitleToggle && <button onClick={() => setTitleExpanded(true)} className="inline-block align-baseline ml-1 text-xs font-semibold px-2 py-1 rounded border border-[#071d7f] text-[#071d7f] pulse-btn bg-white z-10" aria-expanded={false} aria-label="Expand product title">
                          View more
                        </button>}
                    </div>}
                </h1>
              </div>
            </div>

            {/* Price Section */}
            <div className={`p-2 rounded-md ${isB2BUser ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-baseline gap-2 flex-wrap justify-between">
                {/* Price area: promo price (left badge) + original price (right, struck) with discount badge */}
                {(() => {
                const currencyCode = (storeData && (storeData?.metadata?.currency || (storeData as any).currency) || 'USD').toUpperCase();

                // Determine original and promotional prices (use established fields)
                const originalPriceRaw = (product as any).originalPrice || product.source_product?.precio_sugerido_venta || product.precio_venta;
                const promoPriceRaw = (product as any).precio_promocion || (product.precio_venta < (originalPriceRaw || Infinity) ? product.precio_venta : null);
                const originalPriceNum = typeof originalPriceRaw === 'number' ? originalPriceRaw : Number(originalPriceRaw) || null;
                const promoPriceNum = promoPriceRaw != null ? typeof promoPriceRaw === 'number' ? promoPriceRaw : Number(promoPriceRaw) : null;

                // Consider it a promo only when original is greater than promo by a sensible amount
                const hasPromo = promoPriceNum != null && originalPriceNum != null && promoPriceNum < originalPriceNum - 0.005;
                return <div className="flex items-center gap-2">
                      {/* Promo / current price */}
                      {hasPromo ? <span className={`inline-flex items-center gap-1 bg-[#fff5f6] border border-[#f2dede] px-1.5 py-0.5 rounded-sm ${isMobile ? '' : '-ml-1'}`}>
                          <span className="text-[#94111f] font-bold text-base">${promoPriceNum!.toFixed(2)}</span>
                          <span className="text-xs font-medium text-[#94111f]">{currencyCode}</span>
                        </span> : <span className={`inline-flex items-center gap-1 bg-[#fff5f6] border border-[#f2dede] px-1.5 py-0.5 rounded-sm ${isMobile ? '' : '-ml-1'}`}>
                          <span className="text-[#94111f] font-bold text-base">${displayPrice.toFixed(2)}</span>
                          <span className="text-xs font-medium text-[#94111f]">{currencyCode}</span>
                        </span>}

                      {/* Original price & discount, placed right next to promo price */}
                      {hasPromo && originalPriceNum != null && promoPriceNum != null && <>
                          <span className="text-sm text-gray-500 line-through">${originalPriceNum.toFixed(2)}</span>
                          <span className="inline-flex items-center bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                            -{Math.round((originalPriceNum - promoPriceNum) / originalPriceNum * 100)}%
                          </span>
                        </>}
                    </div>;
              })()}
                {isB2BUser && <span className="text-xs font-medium text-white bg-[#94111f] px-2 py-0.5 rounded animate-bounce">
                    B2B
                  </span>}
                {isB2BUser && dynamicPrice !== null && <span className="text-xs font-medium text-white bg-blue-600 px-2 py-0.5 rounded">
                    Motor Dinámico ⚡
                  </span>}
              </div>

              {isB2BUser && <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span className="text-green-600 font-bold">${pvp.toFixed(2)}</span>
                    <span className="text-xs bg-[#29892a] px-1 py-0.5 rounded text-white font-bold animate-bounce">PVP</span>
                  </div>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <div className="text-green-600 font-medium">
                    Margen: {businessSummary?.profitPercentage}%
                  </div>
                </div>}
            </div>

            {/* Color Variants List for Desktop */}
            {!isMobile && images.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Variantes de color</h4>
                <div className="flex flex-wrap gap-3">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`relative overflow-hidden rounded-full border-2 transition-all w-14 h-14 hover:border-gray-400 flex-shrink-0 ${
                        selectedImage === index
                          ? 'border-blue-600 ring-2 ring-blue-100'
                          : 'border-gray-300'
                      }`}
                      title={`Color ${index + 1}`}
                    >
                      <img 
                        src={image} 
                        alt={`Color ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {selectedImage === index && (
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

              {/* Variant Selector - Uses database variants */}
              <div className="mt-3" ref={buySection}>
                {/* Open VariantDrawer for both mobile and desktop */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="mt-3 flex items-center gap-3">
                    <button onClick={() => {
                      if (product) {
                        toggleWishlist({
                          productId: isB2BUser ? product.id : undefined,
                          sellerCatalogId: !isB2BUser ? product.id : undefined,
                          storeId: product.store?.id,
                          type: isB2BUser ? 'B2B' : 'B2C',
                        });
                      }
                    }} className="p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-300 active:scale-90">
                      <Heart className={`w-5 h-5 transition-all duration-300 ${product && (isB2BUser ? isInWishlist(product.id) : isInWishlist(undefined, product.id)) ? 'fill-red-500 text-red-500 animate-heart-shake' : 'text-gray-600'}`} />
                    </button>
                    <Button 
                      onClick={() => {
                        useVariantDrawerStore.getState().open({
                          id: product.id,
                          sku: product.sku,
                          nombre: product.nombre,
                          images: images,
                          price: product.precio_venta,
                          costB2B: costB2B,
                          moq: moq,
                          stock: isB2BUser ? stockB2B : product.stock,
                          source_product_id: product.source_product?.id,
                        }, () => {
                          // onComplete: scroll to recommendations
                          if (recsRef.current) {
                            const offset = isMobile ? 72 : 64;
                            const top = recsRef.current.getBoundingClientRect().top + window.scrollY - offset;
                            window.scrollTo({ top, behavior: 'smooth' });
                          }
                        });
                      }}
                      className="w-auto px-3 h-10 text-sm font-semibold flex items-center gap-2"
                      ref={buyButtonRef}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {isB2BUser ? 'Comprar B2B' : 'Comprar'}
                    </Button>
                  </div>
                </div>
              </div>

            {/* Description */}
            {isMobile ? (
              <div className="mt-10 scroll-mt-20">
                <Button
                  onClick={() => setIsDescriptionDrawerOpen(true)}
                  variant="outline"
                  className="w-full border-2 text-sm font-semibold"
                  style={{ borderColor: '#94111f', color: '#94111f' }}
                >
                  Ver Descripción
                </Button>
              </div>
            ) : (
              <Accordion type="single" collapsible defaultValue="descripcion" className="w-full mt-10">
                <AccordionItem value="descripcion" className="border border-gray-200 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:bg-gray-100 text-left font-semibold text-gray-900 flex items-center justify-between">
                    <span>Descripción</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 py-4 bg-white border-t border-gray-200">
                    <div 
                      className="border-2 rounded-lg p-4 bg-white"
                      style={{ borderColor: '#071d7f' }}
                    >
                      <p className="text-sm text-gray-700 whitespace-pre-line prose prose-sm max-w-none text-gray-600">
                        {product?.descripcion}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="valoraciones" className="border border-gray-200 rounded-lg overflow-hidden mt-3">
                  <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:bg-gray-100 text-left font-semibold text-gray-900 flex items-center justify-between">
                    <span>Valoraciones</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 py-4 bg-white border-t border-gray-200">
                    <ProductReviews productId={product?.source_product?.id || product?.id} productName={product?.nombre} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Description Drawer for Mobile */}
            <Drawer open={isDescriptionDrawerOpen} onOpenChange={setIsDescriptionDrawerOpen}>
              <DrawerContent className="max-h-[50vh] h-[50vh]">
                <div className="mx-auto w-full max-w-sm flex flex-col h-[45vh]">
                  <DrawerHeader className="flex-shrink-0 flex items-center justify-between">
                    <DrawerTitle className="text-lg font-bold">Descripción del Producto</DrawerTitle>
                    <button
                      onClick={() => setIsDescriptionDrawerOpen(false)}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                      style={{ backgroundColor: '#94111f', color: 'white' }}
                      aria-label="Close description"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </DrawerHeader>
                  <div className="flex-1 overflow-y-auto px-4 pb-6">
                    <div 
                      className="border-2 rounded-lg p-4 bg-white"
                      style={{ borderColor: '#071d7f' }}
                    >
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {product?.descripcion}
                      </p>
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>


            {/* Valoraciones - Using ProductReviews component */}
            {isMobile && (
              <div id="section-reviews" ref={reviewsRef} className="mt-10 scroll-mt-20">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Valoraciones</h3>
                <ProductReviews productId={product.source_product?.id || product.id} productName={product.nombre} />
              </div>
            )}

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <Truck className="w-5 h-5 text-blue-600" />
                <div className="text-xs">
                  <p className="font-semibold text-gray-900">Envío Nacional</p>
                  <p className="text-gray-500">24-48 horas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <Shield className="w-5 h-5 text-green-600" />
                <div className="text-xs">
                  <p className="font-semibold text-gray-900">Compra Segura</p>
                  <p className="text-gray-500">Protección total</p>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Related Products */}
        {relatedProducts.length > 0 && <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Productos Relacionados</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedProducts.map(p => <Link key={p.id} to={`/producto/${p.sku}`} className="group">
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
                    <div className="aspect-square bg-gray-100 relative">
                      {Array.isArray(p.images) && p.images[0] && (
                        <img 
                          src={p.images[0]} 
                          alt={p.nombre} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-1 mb-1 group-hover:text-blue-600">
                        {p.nombre}
                      </h3>
                      <p className="text-sm font-bold text-gray-900">
                        ${p.precio_venta.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Link>)}
            </div>
          </div>}

        {/* Recomendados - Full Width */}
        <div id="section-recs" ref={recsRef} className="mt-12 pt-8 border-t border-gray-200 scroll-mt-20">
          {loadingRecommended ? (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900">Recomendados</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-lg overflow-hidden">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : recommendedProducts.length > 0 ? (
            <ProductCarousel
              title="Recomendados"
              products={recommendedProducts}
              itemsPerView={4}
            />
          ) : (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900">Recomendados</h3>
              <div className="bg-gray-50 border rounded-lg p-6 text-center text-gray-400">
                No hay productos recomendados disponibles.
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Variant Drawer portal */}
      <VariantDrawer />

      {/* Floating Cart Icon - appears when buy button is not visible */}
      {isMobile && showFloatingCart && product && (
        <button
          onClick={() => {
            useVariantDrawerStore.getState().open({
              id: product.id,
              sku: product.sku,
              nombre: product.nombre,
              images: images,
              price: product.precio_venta,
              costB2B: costB2B,
              moq: moq,
              stock: isB2BUser ? stockB2B : product.stock,
              source_product_id: product.source_product?.id,
            });
          }}
          className="fixed bottom-32 right-6 z-40 bg-transparent border border-[#94111f] p-1 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 active:scale-95"
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#29892a" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 18C5.9 18 5 18.9 5 20s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.16.12-.33.12-.5 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      )}



      {/* Image Zoom Modal */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-white">
          <div className="relative w-full h-full flex flex-col">
            <button 
              onClick={() => setZoomOpen(false)}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex-1 flex items-center justify-center bg-gray-50 p-4 rounded-lg m-4">
              {images.length > 0 ? (
                <img 
                  src={images[selectedImage]} 
                  alt={product?.nombre} 
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : (
                <Package className="w-24 h-24 text-gray-300" />
              )}
            </div>

            {/* Thumbnail Navigation */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-4 px-4 justify-center">
                {images.map((image, index) => (
                  <button 
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index 
                        ? 'border-blue-600 ring-2 ring-blue-100' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {!isMobile && <Footer />}
    </div>
  );
};

export default ProductPage;