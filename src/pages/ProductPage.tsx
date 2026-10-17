/* eslint-disable @typescript-eslint/no-explicit-any */
import { notifyCartAdded } from "@/lib/cartFeedback";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from '@/types/auth';
import { useCart } from "@/hooks/useCart";
import { useB2BCartSupabase } from "@/hooks/useB2BCartSupabase";
import { useB2BFavorites } from "@/hooks/useB2BFavorites";
import { useB2CFavorites } from "@/hooks/useB2CFavorites";
import { useToast } from '@/hooks/use-toast';
import { useStore } from '@/hooks/useStore';
import { useIsMobile } from "@/hooks/use-mobile";
import { useProductVariants } from "@/hooks/useProductVariants";
import { useB2CCatalogVariants } from "@/hooks/useB2CCatalogVariants";
import { useRecommendedProducts } from "@/hooks/useMarketplaceData";
import { useStoreFollow } from "@/hooks/useTrendingStores";
import { useSEO } from "@/hooks/useSEO";
import { useBranding } from "@/hooks/useBranding";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import VariantSelector from "@/components/products/VariantSelector";
import VariantDrawer from '@/components/products/VariantDrawer';
import useVariantDrawerStore from '@/stores/useVariantDrawerStore';
import { useWhatsAppShareStore } from '@/stores/useWhatsAppShareStore';
import { WhatsAppIcon } from '@/components/products/WhatsAppShareDialog';
import ProductReviews from "@/components/products/ProductReviews";
import OtherSellersSection from "@/components/products/OtherSellersSection";
import ProductCarousel from "@/components/landing/ProductCarousel";
import ProductGrid from "@/components/landing/ProductGrid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger } from
"@/components/ui/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle } from
"@/components/ui/drawer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronRight, ChevronLeft, ShoppingCart, Heart, Store as StoreIcon, Package, TrendingUp, Calculator, Shield, Truck, RotateCcw, Award, MessageCircle, Zap, Info, Star, X, ArrowLeft, Search, Share2, MoreVertical, ZoomIn, ExternalLink } from "lucide-react";

// Hook to fetch product from both seller_catalog and products table by SKU or catalog ID
const useProductBySku = (sku: string | undefined, catalogId: string | undefined, storeId?: string | null) => {
  return useQuery({
    queryKey: ["product-by-sku", sku, catalogId, storeId],
    queryFn: async () => {
      // If catalogId is provided, search directly in seller_catalog by ID
      if (catalogId) {
        const {
          data: sellerProduct,
          error: sellerError
        } = (await (supabase as any).from("seller_catalog").select(`
            *,
            store:stores!seller_catalog_seller_store_id_fkey(
              id, name, logo, whatsapp, is_active, slug
            ),
            source_product:products!seller_catalog_source_product_id_fkey(
              id, categoria_id, precio_mayorista_base, precio_sugerido_venta, moq, stock_fisico, galeria_imagenes,
              category:categories!products_categoria_id_fkey(id, name, slug)
            )
          `).eq("id", catalogId).eq("is_active", true).maybeSingle()) as {data: any;error: any;};

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

      const safeDecode = (value: string) => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      };

      // Normalize/clean SKU from route (defensive against malformed URLs)
      const decodedSku = safeDecode(sku);
      const cleanSku = decodedSku.
      split('?')[0].
      replace(/-undefined$/, '').
      replace(/\/+$/, '').
      trim();

      const normalizedStoreId = storeId?.split('?')[0]?.trim() || null;
      if (!cleanSku) return null;

      const skuCandidates = Array.from(
        new Set(
          [
          cleanSku,
          cleanSku.replace(/\s+/g, '_'),
          cleanSku.replace(/_/g, ' ')].
          filter(Boolean)
        )
      );

      const sellerSelect = `
        *,
        store:stores!seller_catalog_seller_store_id_fkey(
          id, name, logo, whatsapp, is_active, slug
        ),
        source_product:products!seller_catalog_source_product_id_fkey(
          id, categoria_id, precio_mayorista_base, precio_sugerido_venta, moq, stock_fisico, galeria_imagenes,
          category:categories!products_categoria_id_fkey(id, name, slug)
        )
      `;

      const createSellerQuery = () => {
        let query = (supabase as any).
        from("seller_catalog").
        select(sellerSelect).
        eq("is_active", true);

        if (normalizedStoreId) {
          query = query.eq("seller_store_id", normalizedStoreId);
        }

        return query;
      };

      let { data: sellerProducts, error: sellerError } = (await createSellerQuery().
      in("sku", skuCandidates).
      order("updated_at", { ascending: false }).
      limit(1)) as {data: any[];error: any;};

      // Fallback 1: partial base-SKU match (inside selected seller when provided)
      if ((!sellerProducts || sellerProducts.length === 0) && cleanSku.includes('-')) {
        const baseSku = cleanSku.split('-')[0];

        const { data: fallbackProducts, error: fallbackError } = (await createSellerQuery().
        ilike("sku", `${baseSku}%`).
        order("updated_at", { ascending: false }).
        limit(1)) as {data: any[];error: any;};

        sellerProducts = fallbackProducts;
        sellerError = fallbackError;
      }

      // Fallback 2: if seller ID is malformed in URL, still recover by SKU globally
      if ((!sellerProducts || sellerProducts.length === 0) && normalizedStoreId) {
        const { data: globalSkuProducts, error: globalSkuError } = (await (supabase as any).
        from("seller_catalog").
        select(sellerSelect).
        eq("is_active", true).
        in("sku", skuCandidates).
        order("updated_at", { ascending: false }).
        limit(1)) as {data: any[];error: any;};

        sellerProducts = globalSkuProducts;
        sellerError = globalSkuError;
      }

      if (sellerError) {
        console.error("Error fetching seller product by SKU:", { cleanSku, normalizedStoreId, sellerError });
      }

      const sellerProduct = sellerProducts?.[0] || null;
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
        const b2bAny = b2bProduct as any;
        return {
          type: 'products' as const,
          id: b2bAny.id,
          sku: b2bAny.sku_interno,
          nombre: b2bAny.nombre,
          descripcion: b2bAny.descripcion_larga || b2bAny.descripcion_corta,
          precio_venta: b2bAny.precio_b2b,
          precio_costo: b2bAny.costo_base_excel,
          stock: b2bAny.stock_fisico,
          images: b2bAny.galeria_imagenes || (b2bAny.imagen_principal ? [b2bAny.imagen_principal] : []),
          store: null,
          source_product: {
            id: b2bAny.id,
            categoria_id: b2bAny.categoria_id,
            precio_mayorista_base: b2bAny.costo_base_excel,
            precio_sugerido_venta: b2bAny.precio_b2b,
            moq: b2bAny.moq,
            stock_fisico: b2bAny.stock_fisico,
            category: b2bAny.category
          }
        };
      }
      console.error("Product not found for SKU:", sku);
      return null;
    },
    enabled: !!sku || !!catalogId
  });
};
const ProductPage = () => {
  const { t } = useTranslation();
  const [showStickyNav, setShowStickyNav] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [showFloatingCart, setShowFloatingCart] = useState(false);
  const { getValue } = useBranding();
  const imageRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const recsRef = useRef<HTMLDivElement>(null);
  const buySection = useRef<HTMLDivElement>(null);
  const buyButtonRef = useRef<HTMLButtonElement>(null);
  const galleryScrollRef = useRef<HTMLDivElement>(null);
  // Touch scroll state
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartX = useRef(0);
  const touchScrollLeft = useRef(0);

  // --- Image gallery mouse-drag scroll (PC) + sync selectedImage on scroll ---
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  // Swipe threshold (px) to advance/retreat one image
  const SWIPE_THRESHOLD = 50;
  const dragDeltaX = useRef(0);
  const touchDeltaX = useRef(0);

  const goToImage = (direction: 'prev' | 'next') => {
    setSelectedImage((current) => {
      const total = images?.length || 0;
      if (total <= 1) return current;
      if (direction === 'next') return current === total - 1 ? 0 : current + 1;
      return current === 0 ? total - 1 : current - 1;
    });
  };

  const handleGalleryMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current = e.pageX;
    dragDeltaX.current = 0;
  };
  const handleGalleryMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    dragDeltaX.current = e.pageX - dragStartX.current;
  };
  const handleGalleryMouseUp = () => {
    if (!isDragging) return;
    const delta = dragDeltaX.current;
    setIsDragging(false);
    dragDeltaX.current = 0;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      goToImage(delta < 0 ? 'next' : 'prev');
    }
  };

  // Touch events for mobile swipe
  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    setIsTouchDragging(true);
    touchStartX.current = e.touches[0].pageX;
    touchDeltaX.current = 0;
  };
  const handleGalleryTouchMove = (e: React.TouchEvent) => {
    if (!isTouchDragging) return;
    touchDeltaX.current = e.touches[0].pageX - touchStartX.current;
  };
  const handleGalleryTouchEnd = () => {
    if (!isTouchDragging) return;
    const delta = touchDeltaX.current;
    setIsTouchDragging(false);
    touchDeltaX.current = 0;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      goToImage(delta < 0 ? 'next' : 'prev');
    } else if (Math.abs(delta) < 8) {
      setZoomOpen(true);
    }
  };

  const handleGalleryScroll = () => {
    if (!galleryScrollRef.current || isDragging) return;
    const container = galleryScrollRef.current;
    const scrollPos = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    const newIndex = Math.round(scrollPos / itemWidth);
    if (newIndex >= 0 && newIndex < (images?.length || 0)) {
      setSelectedImage(newIndex);
    }
  };

  const scrollGalleryToIndex = (index: number) => {
    if (!galleryScrollRef.current) return;
    const itemWidth = galleryScrollRef.current.offsetWidth;
    galleryScrollRef.current.scrollTo({ left: itemWidth * index, behavior: 'smooth' });
  };
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
    sku: skuParam,
    catalogId
  } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const { role } = useAuth();
  const {
    toast
  } = useToast();
  // Determine if user is B2B (Seller or Admin)
  const isB2BUser = role === UserRole.SELLER || role === UserRole.ADMIN;

  const resolvedSku = useMemo(() => {
    if (skuParam) return skuParam;
    if (location.pathname.startsWith('/producto/catalogo/')) return undefined;
    const routeMatch = location.pathname.match(/^\/producto\/([^/]+)/);
    return routeMatch?.[1];
  }, [skuParam, location.pathname]);

  // Use separate favorite hooks for B2B and B2C
  const b2bFav = useB2BFavorites();
  const b2cFav = useB2CFavorites();

  const toggleFavorite = () => {
    if (!product) return;
    if (isB2BUser) {
      const productId = (product as any).source_product?.id || product.id;
      b2bFav.toggle(productId);
    } else {
      const type = (product as any).type;
      b2cFav.toggle({
        productId: type !== 'seller_catalog' ? product.id : undefined,
        sellerCatalogId: type === 'seller_catalog' ? product.id : undefined
      });
    }
  };

  const isFavorite = (): boolean => {
    if (!product) return false;
    if (isB2BUser) {
      return b2bFav.isInFavorites((product as any).source_product?.id || product.id);
    }
    const type = (product as any).type;
    return b2cFav.isInFavorites(
      type !== 'seller_catalog' ? product.id : undefined,
      type === 'seller_catalog' ? product.id : undefined
    );
  };

  // ===== SELLER / STORE SECTION =====
  const [searchParams] = useSearchParams();
  const sellerParam = searchParams.get('seller')?.trim() || null; // store ID from ?seller= URL param

  // Fetch product data from both tables, filtered by seller if provided
  const {
    data: product,
    isLoading
  } = useProductBySku(resolvedSku, catalogId, sellerParam);

  // Load store profile: prefer the FK-joined store on the product, fall back to ?seller= param
  const {
    data: storeData
  } = useStore((product as any)?.store?.id || sellerParam || undefined);

  // realStore: joined store object OR full storeData fetched via ?seller= param
  const realStore = ((product as any)?.store || storeData) as {id: string;name: string;logo: string | null;slug: string | null;} | null;

  const { followStore, unfollowStore, checkIfFollowing } = useStoreFollow();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const { data: storeFollowersCount = 0, refetch: refetchStoreFollowers } = useQuery({
    queryKey: ["store-followers-count-pp", realStore?.id],
    queryFn: async () => {
      const { count } = await supabase.
      from("store_followers").
      select("id", { count: "exact", head: true }).
      eq("store_id", realStore!.id);
      return count || 0;
    },
    enabled: !!realStore?.id
  });

  const { data: storeRatingData } = useQuery({
    queryKey: ["store-rating-pp", realStore?.id],
    queryFn: async () => {
      const { data } = await supabase.
      from("store_reviews").
      select("rating").
      eq("store_id", realStore!.id);
      if (!data || data.length === 0) return null;
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!realStore?.id
  });

  useEffect(() => {
    if (!user || !realStore?.id) return;
    checkIfFollowing(realStore.id, user.id).then(setIsFollowing);
  }, [user, realStore?.id, checkIfFollowing]);

  const handleStoreFollowToggle = async () => {
    if (!user) {
      sessionStorage.setItem('post_login_redirect', window.location.pathname);
      navigate('/cuenta');
      return;
    }
    if (!realStore?.id) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowStore(realStore.id, user.id);
        setIsFollowing(false);
      } else {
        await followStore(realStore.id, user.id);
        setIsFollowing(true);
      }
      refetchStoreFollowers();
    } finally {
      setFollowLoading(false);
    }
  };
  // ===== END SELLER SECTION =====

  // Fetch recommended products based on current product's category
  const categoryId = product?.source_product?.categoria_id || null;
  const { data: recommendedProducts = [], isLoading: loadingRecommended } = useRecommendedProducts(
    product?.id || null,
    categoryId,
    100,
    product?.source_product?.id || null
  );

  // Fetch product variants with B2B prices if user is seller
  const { data: variants = [] } = useProductVariants(product?.source_product?.id, isB2BUser);

  // For B2C seller products: load seller-specific variants (only in-stock) from seller_catalog_variants
  const sellerCatalogIdForB2C = !isB2BUser && (product as any)?.type === 'seller_catalog' ? product?.id : null;
  const { data: sellerCatalogVariants = [] } = useB2CCatalogVariants(sellerCatalogIdForB2C);

  // Build variant price maps for inline VariantSelector (same logic as VariantDrawer)
  const inlineVariantPrices = useMemo(() => {
    if (!isB2BUser || !variants || variants.length === 0) return {};
    return variants.reduce((acc: Record<string, number>, v: any) => {
      if (v.precio_b2b_final) acc[v.id] = v.precio_b2b_final;
      return acc;
    }, {});
  }, [variants, isB2BUser]);

  const inlineB2cVariantPrices = useMemo(() => {
    if (isB2BUser || sellerCatalogVariants.length === 0) return {};
    return sellerCatalogVariants.reduce((acc: Record<string, number>, v: any) => {
      if (v.productVariantId && v.price != null) acc[v.productVariantId] = Number(v.price);
      return acc;
    }, {});
  }, [isB2BUser, sellerCatalogVariants]);

  // Local state
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [viewTracked, setViewTracked] = useState(false);
  const [pdpSelectedAttributes, setPdpSelectedAttributes] = useState<Record<string, string>>({});
  const [pdpSelectedQuantities, setPdpSelectedQuantities] = useState<Record<string, number>>({});
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
    setVariations((prev) => prev.map((v) => v.id === id ? {
      ...v,
      quantity: Math.max(0, newQty)
    } : v));
  };
  const handleOpenPurchase = () => {
    // If B2B enforce MOQ sum
    if (isB2BUser && totalSelectedQty > 0 && totalSelectedQty < currentMoq) {
      toast({
        title: 'Cantidad mÃ­nima',
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
  // Mobile reviews collapsible (same accordion behavior as desktop)
  const [mobileReviewsOpen, setMobileReviewsOpen] = useState(false);

  // Keyboard navigation for tabs
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      setActiveTab((prev) => prev === 'desc' ? 'reviews' : prev === 'reviews' ? 'recs' : 'desc');
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      setActiveTab((prev) => prev === 'recs' ? 'reviews' : prev === 'reviews' ? 'desc' : 'recs');
    }
  };

  // Scroll-based active tab detection (more reliable than IntersectionObserver here)
  useEffect(() => {
    if (!product) return;

    const ACTIVATION_OFFSET = 140; // px below viewport top where a section is "active"

    const computeActive = () => {
      const sections: { id: 'desc' | 'reviews' | 'recs'; node: HTMLElement | null }[] = [
        { id: 'desc', node: descRef.current },
        { id: 'reviews', node: reviewsRef.current },
        { id: 'recs', node: recsRef.current },
      ];

      const present = sections.filter((s) => s.node) as { id: 'desc' | 'reviews' | 'recs'; node: HTMLElement }[];
      if (present.length === 0) return;

      // Pick the LAST section whose top has crossed the activation line.
      // Fallback to the first present section if none has crossed yet.
      let current: 'desc' | 'reviews' | 'recs' = present[0].id;
      for (const s of present) {
        const top = s.node.getBoundingClientRect().top;
        if (top - ACTIVATION_OFFSET <= 0) {
          current = s.id;
        }
      }
      setActiveTab((prev) => (prev === current ? prev : current));
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        computeActive();
        ticking = false;
      });
    };

    // Initial compute (after layout settles)
    const raf = requestAnimationFrame(computeActive);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [product]);



  // Cart hooks
  const {
    addItem: addItemB2C
  } = useCart();
  const {
    addItem: addItemB2B
  } = useB2BCartSupabase();

  // Derived data
  const images = useMemo(() => {
    if (!product) return [];

    // B2C seller product: prioritize images from seller variants in stock
    if (!isB2BUser && (product as any).type === 'seller_catalog' && sellerCatalogVariants.length > 0) {
      const variantImages = sellerCatalogVariants.
      map((v) => Array.isArray(v.images) ? v.images[0] : null).
      filter((img): img is string => typeof img === 'string' && img.trim() !== '');

      const uniqueVariantImages = Array.from(new Set(variantImages));
      if (uniqueVariantImages.length > 0) {
        return uniqueVariantImages;
      }
    }

    const imgs = product.images as any;
    // Filter out empty strings and invalid URLs
    const validImages = Array.isArray(imgs) ? imgs.filter((img: string) => img && img.trim() !== '') : [];
    return validImages.length > 0 ? validImages : [];
  }, [product, isB2BUser, sellerCatalogVariants]);

  const marketplaceShareImage =
  getValue('share_image_url') || getValue('logo_url') || getValue('favicon_url');
  const productMainImage = images[0] || '';

  useSEO({
    title: product?.nombre || 'Producto',
    description:
      (product?.descripcion && product.descripcion.length >= 50)
        ? product.descripcion
        : `Descubre ${product?.nombre || 'este producto'} en Kizkka. Compra al mejor precio con envío seguro y atención dedicada a tu pedido.`,
    type: 'product',
    image: productMainImage || marketplaceShareImage,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  });

  // Keep selected image index valid if image source changes (e.g. when seller variants load)
  useEffect(() => {
    if (selectedImage >= images.length && images.length > 0) {
      setSelectedImage(0);
    }
  }, [images, selectedImage]);

  // B2B Specific Data
  // Precio B2B real que paga el mayorista (vista v_productos_con_precio_b2b)
  const costB2B = product?.precio_venta || product?.source_product?.precio_mayorista_base || 0;
  const sourceProductIdForPvp = product?.source_product?.id || null;
  const { data: suggestedPvpRpc } = useQuery({
    queryKey: ['suggested-pvp', sourceProductIdForPvp],
    enabled: !!isB2BUser && !!sourceProductIdForPvp,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_suggested_pvp', { p_product_id: sourceProductIdForPvp as string });
      if (error) throw error;
      return Number(data) || 0;
    },
  });
  const pvp = suggestedPvpRpc && suggestedPvpRpc > 0 ? suggestedPvpRpc : 0;
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

  // Business Logic for B2B: compra B2B vs PVP sugerido de reventa
  const businessSummary = useMemo(() => {
    if (!isB2BUser || !product || pvp <= 0 || costB2B <= 0) return null;
    const investment = costB2B * quantity;
    const estimatedRevenue = pvp * quantity;
    const estimatedProfit = estimatedRevenue - investment;
    const profitPerUnit = pvp - costB2B;
    const profitPercentage = (profitPerUnit / costB2B) * 100;
    return {
      investment,
      estimatedRevenue,
      estimatedProfit,
      profitPercentage: profitPercentage.toFixed(0),
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
    // Decide whether to show the "Mostrar mÃ¡s" toggle for long titles (>60 chars)
    if (product && product.nombre) {
      setShowTitleToggle(product.nombre.length > 60);
    }
  }, [product, viewTracked]);

  // DEBUG: log when product loads so developer can confirm updated bundle is used
  useEffect(() => {
    if (product) {
      // eslint-disable-next-line no-console
      console.log('[ProductPage] loaded product:', product.nombre, 'length:', product.nombre?.length);
      console.log('[ProductPage] product.store:', (product as any)?.store);
    }
  }, [product]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[ProductPage] realStore:', realStore, 'isMobile:', isMobile);
  }, [realStore, isMobile]);
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
        variantId: null,
        sku: product.sku || '',
        nombre: product.nombre || '',
        quantity: quantity,
        unitPrice: priceToAdd,
        moq: moq,
        stockDisponible: stockB2B
      });
      notifyCartAdded({ name: product.nombre || '', image: images[0], quantity, isB2B: true });
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
      notifyCartAdded({ name: product.nombre, image: images[0], quantity });
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
          title: 'Cantidad mÃ­nima',
          description: `El pedido total debe ser al menos ${currentMoq} unidades.`,
          className: 'bg-yellow-100'
        });
        return;
      }
      variations.forEach((v) => {
        const qty = v.quantity || 0;
        if (qty <= 0) return;
        if (isB2BUser) {
          const priceToAdd = product.precio_venta || costB2B;
          addItemB2B({
            productId: product.source_product?.id || product.id,
            variantId: null,
            sku: product.sku || '',
            nombre: product.nombre || '',
            quantity: qty,
            unitPrice: priceToAdd,
            moq: moq,
            stockDisponible: stockB2B
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
      </div>);

  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Package className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">{t('products.noProducts')}</h2>
        <Button onClick={() => navigate("/")} className="mt-4">{t('common.back')}</Button>
      </div>);

  }

  // Usar precio de v_productos_con_precio_b2b (ya viene en product.precio_venta)
  const displayPrice = isB2BUser ? product.precio_venta : product.precio_venta;

  // Abre el diálogo de WhatsApp con el detalle del producto actual
  const openWhatsAppShare = () => {
    const currencyCode = ((storeData && (storeData?.metadata?.currency || (storeData as any).currency)) || 'USD').toUpperCase();
    useWhatsAppShareStore.getState().open({
      id: product.id,
      name: product.nombre,
      sku: product.sku,
      price: displayPrice,
      currency: currencyCode,
      image: images[selectedImage] || images[0],
      sourceProductId: product.source_product?.id,
      storeId: product.store?.id || sellerParam || undefined,
      storeWhatsapp: (product as any).store?.whatsapp || (storeData as any)?.whatsapp || undefined
    });
  };


  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Mobile Header Hide - Apply to body via style */}
      {isMobile && showCompactHeader &&
      <style>{`header { display: none !important; }`}</style>
      }

      {/* Desktop Header */}
      {!isMobile && <GlobalHeader />}

      {/* Mobile Header - Hidden when compact header shows */}
      {isMobile && !showCompactHeader && <GlobalHeader />}

      {/* tabsstickyHeader - Compact Header + Sticky Tabs (Mobile) */}
      {isMobile && showCompactHeader &&
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
              className="flex-1 bg-transparent text-sm text-white placeholder-white/60 outline-hidden"
              readOnly />
            
            </div>

            <button
            onClick={() => toggleFavorite()}
            className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded">
            
              <Heart className={`w-5 h-5 ${isFavorite() ? 'fill-red-400 text-red-400' : 'text-white'}`} />
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
                {t('common.description')}
              </button>

              <button id="tab-reviews-mobile" role="tab" aria-selected={activeTab === 'reviews'} aria-controls="section-reviews" tabIndex={activeTab === 'reviews' ? 0 : -1} onClick={() => {
              setActiveTab('reviews');
              setMobileReviewsOpen(true);
              scrollToSection(reviewsRef);
            }} onKeyDown={handleTabKeyDown} className={`px-2 py-0.5 text-xs font-semibold ${activeTab === 'reviews' ? 'bg-[#071d7f] text-white rounded-full shadow-sm' : 'bg-white border border-blue-100 text-[#071d7f] rounded-md'}`}>
                {t('productPage.productReviews')}
              </button>

              <button id="tab-recs-mobile" role="tab" aria-selected={activeTab === 'recs'} aria-controls="section-recs" tabIndex={activeTab === 'recs' ? 0 : -1} onClick={() => {
              setActiveTab('recs');
              scrollToSection(recsRef);
            }} onKeyDown={handleTabKeyDown} className={`px-2 py-0.5 text-xs font-semibold ${activeTab === 'recs' ? 'bg-[#071d7f] text-white rounded-full shadow-sm' : 'bg-white border border-blue-100 text-[#071d7f] rounded-md'}`}>
                {t('products.seeMore')}
              </button>
            </div>
          </div>
        </div>
      }

      {/* Sticky Nav Tabs: reemplaza la barra de categorÃ­as */}
      {/* REMOVED: Desktop sticky nav replaced with Accordion component */}

      <main className={`container mx-auto ${isMobile ? 'px-0 pb-24 pt-0' : 'px-4 pb-12 py-4'}`}>
        {/* Breadcrumb / Retorno Button - Desktop */}
        {!isMobile &&
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#071d7f] hover:text-[#0a2a9f] mb-6 md:mt-16 group transition-all">
          
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">{t('common.back')}</span>
          </button>
        }

        <div className={`${isMobile ? 'grid grid-cols-1 gap-2 mb-3' : 'grid grid-cols-2 gap-8 mb-8'}`}>
          {/* Image Gallery */}
          <div ref={imageRef} className={`${isMobile ? 'w-full space-y-2' : 'space-y-4 sticky top-0 h-fit'}`}>
            <div
              ref={galleryScrollRef}
              onClick={() => !isMobile && setZoomOpen(true)}
              className={`relative bg-white overflow-hidden shadow-sm border-gray-100 cursor-zoom-in ${isMobile ? 'w-full aspect-[4/5] rounded-none border-y' : 'rounded-2xl aspect-square border'}`}
              style={{ touchAction: 'pan-y' }}
              onMouseDown={handleGalleryMouseDown}
              onMouseMove={handleGalleryMouseMove}
              onMouseUp={handleGalleryMouseUp}
              onMouseLeave={handleGalleryMouseUp}
              onTouchStart={handleGalleryTouchStart}
              onTouchMove={handleGalleryTouchMove}
              onTouchEnd={handleGalleryTouchEnd}>
              
              {/* Thumbnails vertical box at left for ALL devices */}
              {images.length > 1 && !isMobile &&
              <div
                className="absolute left-2 bottom-2 z-10 flex flex-col gap-2 bg-transparent rounded-xl p-2 shadow-md overflow-y-auto"
                style={{
                  width: '64px',
                  maxHeight: 'calc(100% - 16px)',
                  scrollbarWidth: 'none', // Firefox
                  msOverflowStyle: 'none' // IE/Edge
                }}
                /* Oculta scroll en navegadores Webkit */
                /* language=CSS */
                /* ::-webkit-scrollbar { display: none; } */>
                
                  {images.map((image, index) =>
                <button key={index} onClick={(e) => {e.stopPropagation();setSelectedImage(index);}}
                className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === index ? "border-blue-600 ring-2 ring-blue-100" : "border-transparent bg-white"}`}>
                  
                      <img src={image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                    </button>
                )}
                </div>
              }
              {images.length > 0 ?
              <div className="w-full h-full flex items-center justify-center">
                  <img
                  src={images[selectedImage]}
                  alt={product.nombre}
                  className={`w-full h-full ${isMobile ? 'object-cover' : 'object-contain p-4'}`}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  draggable={false} />
                
                </div> :

              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <Package className="h-20 w-20 text-gray-300" />
                </div>
              }

              {/* Navigation Arrows */}
              {images.length > 1 && !isMobile && <>
                  <button onClick={(e) => {
                  e.stopPropagation();
                  const newIdx = selectedImage === 0 ? images.length - 1 : selectedImage - 1;
                  setSelectedImage(newIdx);
                  scrollGalleryToIndex(newIdx);
                }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 shadow-md rounded-full p-2 hover:bg-white">
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button onClick={(e) => {
                  e.stopPropagation();
                  const newIdx = selectedImage === images.length - 1 ? 0 : selectedImage + 1;
                  setSelectedImage(newIdx);
                  scrollGalleryToIndex(newIdx);
                }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 shadow-md rounded-full p-2 hover:bg-white">
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </>}
              {images.length > 1 && isMobile &&
              <span className="absolute bottom-3 right-3 rounded-full bg-foreground/60 px-2.5 py-1 text-[11px] font-bold text-background backdrop-blur-sm">
                  {selectedImage + 1}/{images.length}
                </span>}

              {/* B2B metrics are shown in the dedicated margin card below the price */}
              
              <button
                onClick={() => toggleFavorite()}
                className="absolute top-4 right-4 bg-white/80 hover:bg-white rounded-full p-2 shadow-sm transition">
                
                <Heart
                  className={`w-5 h-5 transition-colors ${
                  isFavorite() ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-500'}`
                  } />
                
              </button>
            </div>

            {/* Thumbnails for Desktop (moved to overlay above) */}

            {/* Color Variants Grid for Mobile */}
            {isMobile && images.length > 1 &&
            <div className="flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
                {images.map((image, index) =>
              <button key={index} onClick={() => {setSelectedImage(index);scrollGalleryToIndex(index);}}
              className={`flex-shrink-0 size-14 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === index ? 'border-price shadow-md scale-105' : 'border-transparent opacity-70'}`}>
                    <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
              )}
              </div>
            }
            {/* Eliminada la cuadrícula de miniaturas para mobile, solo queda el box vertical a la izquierda */}

          </div>

          {/* Product Info */}
          <div className={`${isMobile ? 'space-y-1.5 px-3 w-full' : 'space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] pr-4'}`}> 
            <div>
              {/* Badges */}
              <div className={`flex flex-wrap items-center gap-2 ${isMobile ? 'mb-1.5' : 'mb-3'}`}>
                {isB2BUser ? <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/15 border-0 font-bold">
                    {t('auth.roles.b2b')}
                  </Badge> : <Badge className="rounded-full bg-price text-price-foreground hover:bg-price border-0 font-bold">
                    {t('products.new')}
                  </Badge>}
                {product.store && <Link to={`/tienda/${product.store.slug || product.store.id}`} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-border bg-card text-xs font-semibold text-foreground shadow-sm hover:border-primary/40 transition-colors">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <StoreIcon className="w-3 h-3" />
                    </span>
                    <span className="max-w-[140px] truncate">{product.store.name}</span>
                    <span className="flex items-center gap-0.5 ml-0.5 pl-1.5 border-l border-border">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold">5.0</span>
                    </span>
                  </Link>}
              </div>

              <div className="flex flex-col gap-1">
                <h1 className="text-lg md:text-2xl font-bold text-foreground leading-snug tracking-tight mb-0">
                  <span className={titleExpanded ? 'whitespace-normal' : 'line-clamp-2 break-words'}>{product.nombre}</span>
                </h1>
                {showTitleToggle && <button onClick={() => setTitleExpanded(!titleExpanded)} className="self-start text-xs font-semibold text-primary hover:underline" aria-expanded={titleExpanded}>
                    {titleExpanded ? 'View less' : 'View more'}
                  </button>}
              </div>

              {/* Social proof & urgency */}
              {(() => {
                const stockNow = Number(isB2BUser ? stockB2B : product.stock) || 0;
                return <div className={`${isMobile ? 'mt-1' : 'mt-2'} flex flex-wrap items-center gap-x-3 gap-y-1 text-xs`}>
                    {storeRatingData && <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        {storeRatingData.avg}
                        <span className="font-normal text-muted-foreground">({storeRatingData.count})</span>
                      </span>}
                    {stockNow > 0 && stockNow <= 10 ? <span className="inline-flex items-center gap-1 rounded-full bg-price/10 px-2 py-0.5 font-bold text-price">
                        <span className="size-1.5 rounded-full bg-price animate-pulse" />
                        {t('pdpPro.lowStock', { count: stockNow, defaultValue: 'Solo quedan {{count}}' })}
                      </span> : stockNow > 10 ? <span className="inline-flex items-center gap-1 font-semibold text-profit">
                        <span className="size-1.5 rounded-full bg-profit" />
                        {t('pdpPro.inStock', { defaultValue: 'En stock' })}
                      </span> : null}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Truck className="w-3.5 h-3.5 text-primary" />
                      {t('pdpPro.delivery', { defaultValue: 'Entrega estimada 24-48h' })}
                    </span>
                  </div>;
              })()}
            </div>

            {/* Price Section */}
            <div className={`rounded-2xl border border-price/15 bg-gradient-to-br from-price/10 via-price/5 to-transparent ${isMobile ? 'px-3 py-2' : 'p-3.5'}`}>
              <div className="flex items-center gap-2 flex-wrap justify-between">
                {(() => {
                  const currencyCode = (storeData && (storeData?.metadata?.currency || (storeData as any).currency) || 'USD').toUpperCase();
                  const originalPriceRaw = (product as any).originalPrice || product.source_product?.precio_sugerido_venta || product.precio_venta;
                  const promoPriceRaw = (product as any).precio_promocion || (product.precio_venta < (originalPriceRaw || Infinity) ? product.precio_venta : null);
                  const originalPriceNum = typeof originalPriceRaw === 'number' ? originalPriceRaw : Number(originalPriceRaw) || null;
                  const promoPriceNum = promoPriceRaw != null ? typeof promoPriceRaw === 'number' ? promoPriceRaw : Number(promoPriceRaw) : null;
                  const hasPromo = promoPriceNum != null && originalPriceNum != null && promoPriceNum < originalPriceNum - 0.005;
                  const shown = hasPromo ? promoPriceNum! : displayPrice;
                  return <div className="flex items-end gap-2 flex-wrap">
                      <span className="flex items-start leading-none text-price">
                        <span className="text-lg font-bold mt-1">$</span>
                        <span className="text-3xl lg:text-4xl font-extrabold tracking-tight">{Math.floor(shown)}</span>
                        <span className="text-lg font-bold mt-1">.{shown.toFixed(2).split('.')[1]}</span>
                        <span className="ml-1.5 self-end mb-1 text-xs font-semibold text-muted-foreground">{currencyCode}</span>
                      </span>
                      {hasPromo && originalPriceNum != null && promoPriceNum != null && <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm text-muted-foreground line-through">${originalPriceNum.toFixed(2)}</span>
                          <span className="inline-flex items-center rounded-full bg-price px-2 py-0.5 text-xs font-bold text-price-foreground shadow-sm animate-pulse">
                            -{Math.round((originalPriceNum - promoPriceNum) / originalPriceNum * 100)}%
                          </span>
                        </div>}
                    </div>;
                })()}
                {isB2BUser && <span className="rounded-full bg-gradient-to-r from-primary to-primary/80 px-3 py-1 text-[11px] font-bold tracking-wide text-primary-foreground shadow-sm">
                    B2B
                  </span>}
              </div>

              {/* B2B margin card */}
              {isB2BUser && businessSummary &&
              <div className="mt-2 rounded-lg border border-profit-border bg-card p-2 shadow-sm lg:mt-3 lg:bg-profit-soft lg:p-3 lg:shadow-none">
                  <div className="mb-1.5 flex items-center gap-1.5 lg:mb-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-profit-soft lg:size-auto lg:bg-transparent">
                      <TrendingUp className="size-4 text-profit" />
                    </span>
                    <p className="text-[11px] font-bold uppercase text-profit lg:text-[12px] lg:font-semibold">
                      {t('productPdp.margin.title')}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 lg:gap-3">
                    <div className="order-2 rounded-md border border-profit-border bg-profit-soft p-1.5 lg:rounded-lg lg:order-2 lg:border-0 lg:bg-transparent lg:p-0">
                      <p className="mb-0.5 text-[10px] font-medium leading-3 text-profit-foreground lg:text-[12px]">{t('productPdp.margin.profitPerUnit')}</p>
                      <div className="flex flex-col gap-0.5 lg:block">
                        <p className="text-sm font-bold leading-none text-profit lg:text-sm lg:leading-5 lg:text-profit">
                          ${businessSummary.profitPerUnit.toFixed(2)}
                        </p>
                        <span className="self-start shrink-0 rounded-full bg-profit px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground lg:ml-1 lg:bg-transparent lg:p-0 lg:font-medium lg:text-profit">
                          +{businessSummary.profitPercentage}%
                        </span>
                      </div>
                    </div>
                    <div className="order-1 rounded-md border border-border bg-muted/40 p-1.5 lg:rounded-lg lg:order-1 lg:border-0 lg:bg-transparent lg:p-0">
                      <p className="mb-0.5 text-[10px] font-medium leading-3 text-muted-foreground lg:text-[12px]">{t('productPdp.margin.b2bPrice')}</p>
                      <p className="text-sm font-bold leading-4 text-foreground">${costB2B.toFixed(2)}</p>
                    </div>
                    <div className="order-3 rounded-md border border-border bg-muted/40 p-1.5 lg:rounded-lg lg:order-3 lg:border-0 lg:bg-transparent lg:p-0">
                      <p className="mb-0.5 text-[10px] font-medium leading-3 text-muted-foreground lg:text-[12px]">{t('productPdp.margin.suggestedPvp')}</p>
                      <p className="text-sm font-bold leading-4 text-foreground">${pvp.toFixed(2)}</p>
                    </div>
                  </div>
                </div>}
            </div>

            {/* Variant Selector - Inline on product page */}
            <div className={isMobile ? 'mt-1' : 'mt-4'}>
              <VariantSelector
                productId={product?.source_product?.id || product?.id}
                basePrice={product?.precio_venta || 0}
                baseImage={product?.images?.[0] || images[0]}
                isB2B={isB2BUser}
                variantPrices={inlineVariantPrices}
                b2cVariantPrices={inlineB2cVariantPrices}
                minimal={true}
                hideVariantImage={true}
                onAttributeChange={(attrs) => setPdpSelectedAttributes(attrs)}
                onSelectionChange={(list) => {
                  const qtyMap: Record<string, number> = {};
                  list.forEach((s: any) => { if (s.quantity > 0) qtyMap[s.variantId] = s.quantity; });
                  setPdpSelectedQuantities(qtyMap);
                }}
                onVariantImageChange={(imageUrl) => {
                  if (imageUrl) {
                    const idx = images.indexOf(imageUrl);
                    if (idx >= 0) {
                      setSelectedImage(idx);
                      scrollGalleryToIndex(idx);
                    }
                  }
                }} />
            </div>

              {/* Variant Selector - Uses database variants */}
              <div className={isMobile ? 'hidden' : 'mt-3'} ref={buySection}>
                {/* Open VariantDrawer for both mobile and desktop */}
                <div className="py-1">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => toggleFavorite()} aria-label="Favorite" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:border-price/40 transition-all duration-300 active:scale-90">
                      <Heart className={`w-5 h-5 transition-all duration-300 ${isFavorite() ? 'fill-price text-price animate-heart-shake' : 'text-muted-foreground'}`} />
                    </button>
                    <button
                      type="button"
                      onClick={openWhatsAppShare}
                      title={t('whatsappShare.button')}
                      aria-label={t('whatsappShare.button')}
                      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-profit text-primary-foreground shadow-md hover:brightness-110 transition-all duration-300 active:scale-90"
                    >
                      <WhatsAppIcon className="w-5 h-5" />
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
                        sellerCatalogId: (product as any).type === 'seller_catalog' ? product.id : undefined,
                        storeId: product.store?.id || sellerParam || undefined
                      }, () => {
                        if (recsRef.current) {
                          const offset = isMobile ? 72 : 64;
                          const top = recsRef.current.getBoundingClientRect().top + window.scrollY - offset;
                          window.scrollTo({ top, behavior: 'smooth' });
                        }
                      }, pdpSelectedAttributes, pdpSelectedQuantities);
                    }}
                    className="flex-1 h-12 rounded-full bg-price text-price-foreground text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-price/30 hover:bg-price/90 hover:shadow-xl transition-all active:scale-[0.98]"
                    ref={buyButtonRef}>
                    
                      <ShoppingCart className="w-4 h-4" />
                      {isB2BUser ? t('productPage.buyWholesale') : t('common.buy')}
                    </Button>
                  </div>
                </div>
              </div>

            {/* Description */}
            {isMobile ?
            <div id="section-desc" ref={descRef} className="mt-1 scroll-mt-20 border-t border-border">
                <button
                type="button"
                onClick={() => setIsDescriptionDrawerOpen(true)}
                className="w-full flex items-center justify-between py-2 text-sm font-semibold text-foreground">
                  {t('productPage.productDescription')}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div> :

            <>
              {/* Sección del Vendedor - Desktop (visible siempre, encima de los accordions) */}
              {realStore &&
              <div className="bg-white rounded-xl p-5 mt-6 mb-4 border border-gray-200 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('otherSellers.soldBy')}</p>
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => navigate(`/tienda/${realStore.slug || realStore.id}`)} className="flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50 flex items-center justify-center hover:opacity-90 transition">
                      {realStore.logo ?
                    <img src={realStore.logo} alt={realStore.name} className="w-full h-full object-cover" /> :
                    <span className="text-lg font-bold text-[#071d7f]">{realStore.name.substring(0, 2).toUpperCase()}</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <button type="button" onClick={() => navigate(`/tienda/${realStore.slug || realStore.id}`)} className="font-bold text-gray-900 hover:text-[#071d7f] transition-colors flex items-center gap-1.5 text-base">
                        {realStore.name}<ExternalLink className="w-3.5 h-3.5 opacity-40" />
                      </button>
                      <div className="flex items-center gap-2 mt-1">
                        {storeRatingData ?
                      <>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(storeRatingData.avg) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-200'}`} />)}
                              </div>
                              <span className="text-sm font-semibold text-gray-800">{storeRatingData.avg}</span>
                              <span className="text-sm text-gray-400">{t('otherSellers.reviewsCount', { count: storeRatingData.count })}</span>
                            </> :
                      <span className="text-sm text-gray-400">{t('otherSellers.noReviews')}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={handleStoreFollowToggle} disabled={followLoading} className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition disabled:opacity-50 ${isFollowing ? 'bg-red-50 border-red-300 text-red-600' : 'bg-[#071d7f] border-[#071d7f] text-white'}`}>
                      <Heart className={`w-4 h-4 ${isFollowing ? 'fill-red-500 text-red-500' : 'fill-white text-white'}`} />
                      {storeFollowersCount > 0 && <span>{storeFollowersCount}</span>}
                      <span>{isFollowing ? t('otherSellers.following') : t('otherSellers.follow')}</span>
                    </button>
                  </div>
                </div>
              }


              <div id="section-desc" ref={descRef} className="scroll-mt-20">
              <Accordion type="single" collapsible defaultValue="descripcion" className="w-full mt-4">
                <AccordionItem value="descripcion" className="border border-gray-200 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:bg-gray-100 text-left font-semibold text-gray-900 flex items-center justify-between">
                    <span>{t('common.description')}</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 py-4 bg-white border-t border-gray-200">
                    <div
                      className="border-2 rounded-lg p-4 bg-white"
                      style={{ borderColor: '#071d7f' }}>
                      
                      <p className="text-sm text-gray-700 whitespace-pre-line prose prose-sm max-w-none text-gray-600">
                        {product?.descripcion}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="valoraciones" className="border border-gray-200 rounded-lg overflow-hidden mt-3">
                  <AccordionTrigger className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:bg-gray-100 text-left font-semibold text-gray-900 flex items-center justify-between">
                    <span>{t('productPage.productReviews')}</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 py-4 bg-white border-t border-gray-200">
                    <ProductReviews productId={product?.source_product?.id || product?.id} productName={product?.nombre} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              </div>
              </>
            }

            {/* Description Drawer for Mobile */}
            <Drawer open={isDescriptionDrawerOpen} onOpenChange={setIsDescriptionDrawerOpen}>
              <DrawerContent className="max-h-[50vh] h-[50vh]">
                <div className="mx-auto w-full max-w-sm flex flex-col h-[45vh]">
                  <DrawerHeader className="flex-shrink-0 flex items-center justify-between">
                    <DrawerTitle className="text-lg font-bold">{t('productPage.productDescription')}</DrawerTitle>
                    <button
                      onClick={() => setIsDescriptionDrawerOpen(false)}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                      style={{ backgroundColor: '#94111f', color: 'white' }}
                      aria-label="Close description">
                      
                      <X className="w-5 h-5" />
                    </button>
                  </DrawerHeader>
                  <div className="flex-1 overflow-y-auto px-4 pb-6">
                    <div
                      className="border-2 rounded-lg p-4 bg-white"
                      style={{ borderColor: '#071d7f' }}>
                      
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {product?.descripcion}
                      </p>
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>


            {/* Valoraciones - Using ProductReviews component */}
            {isMobile &&
            <>
                {/* Sección del Vendedor - Mobile */}
                {realStore &&
              <div className="bg-card rounded-xl p-2 mt-1 border border-border">
                    <h2 className="text-xs font-bold text-muted-foreground mb-1.5">{t('otherSellers.soldBy')}</h2>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => navigate(`/tienda/${realStore.slug || realStore.id}`)} className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-gray-100 shadow-sm bg-white flex items-center justify-center">
                        {realStore.logo ? <img src={realStore.logo} alt={realStore.name} className="w-full h-full object-cover" /> : <span className="text-base font-bold text-[#071d7f]">{realStore.name.substring(0, 2).toUpperCase()}</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <button type="button" onClick={() => navigate(`/tienda/${realStore.slug || realStore.id}`)} className="font-semibold text-gray-900 hover:text-[#071d7f] transition-colors flex items-center gap-1 text-sm">
                          {realStore.name}<ExternalLink className="w-3 h-3 opacity-40" />
                        </button>
                        <div className="flex items-center gap-1 mt-0.5">
                          {storeRatingData ? <><div className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3 h-3 ${i <= Math.round(storeRatingData.avg) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-200'}`} />)}</div><span className="text-xs font-semibold text-gray-700">{storeRatingData.avg}</span><span className="text-xs text-gray-400">({storeRatingData.count})</span></> : <span className="text-xs text-gray-400">{t('otherSellers.noReviews')}</span>}
                        </div>
                      </div>
                      <button type="button" onClick={handleStoreFollowToggle} disabled={followLoading} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border disabled:opacity-50 ${isFollowing ? 'bg-red-50 border-red-300 text-red-600' : 'bg-[#071d7f] border-[#071d7f] text-white'}`}>
                        <Heart className={`w-3.5 h-3.5 ${isFollowing ? 'fill-red-500 text-red-500' : 'fill-white text-white'}`} />
                        {storeFollowersCount > 0 && <span>{storeFollowersCount}</span>}
                        <span>{isFollowing ? t('otherSellers.following') : t('otherSellers.follow')}</span>
                      </button>
                    </div>
                  </div>
              }
                <div id="section-reviews" ref={reviewsRef} className="mt-1.5 scroll-mt-20">
                  <Accordion
                    type="single"
                    collapsible
                    value={mobileReviewsOpen ? 'valoraciones-movil' : ''}
                    onValueChange={(v) => setMobileReviewsOpen(v === 'valoraciones-movil')}
                    className="w-full">
                    <AccordionItem value="valoraciones-movil" className="border border-gray-200 rounded-lg overflow-hidden">
                      <AccordionTrigger className="px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 hover:bg-gray-100 text-left font-semibold text-gray-900 flex items-center justify-between text-sm">
                        <span>{t('productPage.productReviews')}</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 py-4 bg-white border-t border-gray-200">
                        <ProductReviews productId={product.source_product?.id || product.id} productName={product.nombre} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </>
            }

            {/* Trust Badges */}
            <div className={`grid grid-cols-2 ${isMobile ? 'gap-1.5 pt-0.5' : 'gap-3 pt-4'}`}>
              <div className="flex items-center gap-2 p-2 lg:gap-3 lg:p-3 rounded-xl lg:rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent">
                <span className="flex size-7 lg:size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Truck className="w-5 h-5 text-primary" />
                </span>
                <div className="text-xs">
                  <p className="font-bold text-foreground">{t('productPage.fastShipping')}</p>
                  <p className="text-muted-foreground">24-48h</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 lg:gap-3 lg:p-3 rounded-xl lg:rounded-2xl border border-profit-border bg-gradient-to-br from-profit-soft to-transparent">
                <span className="flex size-7 lg:size-9 shrink-0 items-center justify-center rounded-full bg-profit/10">
                  <Shield className="w-5 h-5 text-profit" />
                </span>
                <div className="text-xs">
                  <p className="font-bold text-foreground">{t('productPage.buyerProtection')}</p>
                  <p className="text-muted-foreground">{t('productPage.buyerProtectionDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Related Products */}
        {relatedProducts.length > 0 && <div className={isMobile ? 'mt-2' : 'mt-12'}>
            <h2 className="text-lg md:text-[18px] font-semibold text-gray-900 mb-6">{t('products.seeMore')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedProducts.map((p) => <Link key={p.id} to={`/producto/${p.sku}`} className="group">
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
                    <div className="aspect-[3/4] bg-gray-100 relative">
                      {Array.isArray(p.images) && p.images[0] &&
                  <img
                    src={p.images[0]}
                    alt={p.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous" />

                  }
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-normal text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600">
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
        <div id="section-recs" ref={recsRef} className={`${isMobile ? 'mt-1 pt-1.5' : 'mt-12 pt-8'} border-t border-border scroll-mt-20`}>
          <h2 className={`text-lg md:text-[18px] font-semibold text-foreground ${isMobile ? 'mb-1.5' : 'mb-4'}`}>{t('products.seeMore')}</h2>
          <OtherSellersSection
            sourceProductId={(product as any)?.source_product?.id || (product as any)?.source_product_id || null}
            currentCatalogId={(product as any)?.type === 'seller_catalog' ? product.id : null}
            compact={isMobile}
          />

          {loadingRecommended ?
          <ProductGrid products={[]} isLoading={true} skeletonCount={20} className={isMobile ? 'py-1' : undefined} /> :
          recommendedProducts.length > 0 ?
          <ProductGrid products={recommendedProducts} isLoading={false} className={isMobile ? 'py-1' : undefined} /> :

          <div className="bg-gray-50 border rounded-lg p-6 text-center text-gray-400">
              {t('products.noProducts')}
            </div>
          }
        </div>
      </main>

      {/* Variant Drawer portal */}
      <VariantDrawer />

      {/* Mobile sticky action bar - stays above the site bottom navigation */}
      {isMobile && product &&
      <div className="fixed bottom-12 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-3 py-2 flex items-center gap-2">
          <button
            onClick={() => toggleFavorite()}
            aria-label="favorite"
            className="p-2.5 rounded-lg border border-gray-200 bg-white">
            <Heart className={`w-5 h-5 ${isFavorite() ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
          </button>
          <button
            type="button"
            onClick={openWhatsAppShare}
            aria-label={t('whatsappShare.button')}
            title={t('whatsappShare.button')}
            className="p-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white">
            <WhatsAppIcon className="w-5 h-5" />
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
                sellerCatalogId: (product as any).type === 'seller_catalog' ? product.id : undefined,
                storeId: product.store?.id || sellerParam || undefined
              }, undefined, pdpSelectedAttributes, pdpSelectedQuantities);
            }}
            className="flex-1 h-11 text-sm font-semibold">
            {isB2BUser ? t('productPage.buyWholesale') : t('common.buy')}
          </Button>
        </div>
      }



      {/* Image Zoom Modal - swipeable fullscreen gallery */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl w-screen h-[100dvh] sm:h-auto sm:max-h-[92vh] p-0 bg-background border-0 sm:rounded-lg [&>button]:hidden">
          <div className="relative w-full h-full flex flex-col">
            <div className="absolute top-3 left-0 right-0 z-10 flex items-center justify-between px-3">
              <span className="rounded-full bg-foreground/60 px-3 py-1 text-xs font-bold text-background">
                {selectedImage + 1}/{images.length || 1}
              </span>
              <button
                onClick={() => setZoomOpen(false)}
                aria-label="Close"
                className="bg-background rounded-full p-2 shadow-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            {images.length > 0 ?
            <div
              ref={(el) => {
                if (el && !el.dataset.init) {
                  el.dataset.init = '1';
                  requestAnimationFrame(() => { el.scrollLeft = el.clientWidth * selectedImage; });
                }
              }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const idx = Math.round(el.scrollLeft / el.clientWidth);
                if (idx !== selectedImage && idx >= 0 && idx < images.length) setSelectedImage(idx);
              }}
              className="flex-1 min-h-0 flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ touchAction: 'pan-x pinch-zoom' }}>
                {images.map((image, index) =>
              <div key={index} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center bg-muted/40 sm:min-h-[70vh]">
                    <img
                  src={image}
                  alt={product?.nombre}
                  className="max-w-full max-h-[80vh] object-contain"
                  referrerPolicy="no-referrer"
                  draggable={false} />
                  </div>
              )}
              </div> :
            <div className="flex-1 flex items-center justify-center">
                <Package className="w-24 h-24 text-muted-foreground" />
              </div>
            }

            {images.length > 1 &&
            <div className="flex gap-2 overflow-x-auto py-3 px-3">
                {images.map((image, index) =>
              <button
                key={index}
                onClick={(e) => {
                  setSelectedImage(index);
                  const scroller = (e.currentTarget.parentElement?.previousElementSibling as HTMLElement | null);
                  scroller?.scrollTo({ left: scroller.clientWidth * index, behavior: 'smooth' });
                }}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                selectedImage === index ? 'border-primary' : 'border-border'}`}>
                    <img src={image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
              )}
              </div>
            }
          </div>
        </DialogContent>
      </Dialog>

      {!isMobile && <Footer />}
    </div>);

};

export default ProductPage;
