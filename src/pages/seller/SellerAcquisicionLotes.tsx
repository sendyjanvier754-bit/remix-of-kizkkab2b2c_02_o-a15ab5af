import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useB2BCartSupabase } from "@/hooks/useB2BCartSupabase";
import { SellerLayout } from "@/components/seller/SellerLayout";
import Footer from "@/components/layout/Footer";
import ProductCardB2B from "@/components/b2b/ProductCardB2B";
import CartSidebarB2B from "@/components/b2b/CartSidebarB2B";
import { B2BFilters, CartItemB2B, ProductB2BCard } from "@/types/b2b";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProductsB2B, useFeaturedProductsB2B } from "@/hooks/useProductsB2B";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import FeaturedProductsCarousel from "@/components/b2b/FeaturedProductsCarousel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

// Content component removed - logic moved to SellerAcquisicionLotesContentWithFilters
const normalizeCategoryId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value !== 'string') return null;

  const v = value.trim().toLowerCase();
  if (!v || v === 'todo' || v === 'all' || v === 'null' || v === 'undefined') return null;

  // If it's not a UUID, treat it as "no category" to avoid accidental empty results
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
};

const SellerAcquisicionLotes = () => {
  const location = useLocation();

  const [filters, setFiltersState] = useState<B2BFilters>({
    searchQuery: "",
    category: normalizeCategoryId(location.state?.selectedCategory),
    stockStatus: "all",
    sortBy: "newest"
  });

  useEffect(() => {
    // Only update filters from navigation state when the value actually changes.
    // This prevents wiping the already-loaded product list due to unnecessary state updates.
    if (location.state?.selectedCategory !== undefined) {
      const nextCategory = normalizeCategoryId(location.state.selectedCategory);
      setFiltersState(prev => {
        if (prev.category === nextCategory) return prev;
        return {
          ...prev,
          category: nextCategory,
        };
      });
    }
  }, [location.state]);

  const handleCategorySelect = (categoryId: string | null) => {
    const nextCategory = normalizeCategoryId(categoryId);
    setFiltersState(prev => {
      if (prev.category === nextCategory) return prev;
      return {
        ...prev,
        category: nextCategory,
      };
    });
  };

  const handleSearch = (query: string) => {
    setFiltersState(prev => ({
      ...prev,
      searchQuery: query
    }));
  };

  return (
    <SellerLayout
      headerVariant="seller"
      selectedCategoryId={filters.category}
      onCategorySelect={handleCategorySelect}
      onSearch={handleSearch}
    >
      <SellerAcquisicionLotesContentWithFilters filters={filters} setFilters={setFiltersState} />
    </SellerLayout>
  );
};

interface ContentWithFiltersProps {
  filters: B2BFilters;
  setFilters: React.Dispatch<React.SetStateAction<B2BFilters>>;
}

const SellerAcquisicionLotesContentWithFilters = ({ filters, setFilters }: ContentWithFiltersProps) => {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const { cart, addItem: addItemToCart, updateQuantity, removeItem } = useB2BCartSupabase();
  const isMobile = useIsMobile();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [allProducts, setAllProducts] = useState<ProductB2BCard[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 24;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const [whatsappNumber, setWhatsappNumber] = useState("50369596772");

  // Fetch products from database
  const { 
    data: productsData, 
    isLoading: productsLoading, 
    isFetching,
    error: productsError 
  } = useProductsB2B(filters, currentPage, itemsPerPage);
  
  const { data: featuredProducts = [] } = useFeaturedProductsB2B(6);
  
  // Accumulate products for infinite scroll
  useEffect(() => {
    if (productsData?.products) {
      if (currentPage === 0) {
        setAllProducts(productsData.products);
      } else {
        setAllProducts(prev => [...prev, ...productsData.products]);
      }
      setHasMore(productsData.products.length === itemsPerPage);
    }
  }, [productsData, currentPage]);

  // Reset when filters change (skip first render to avoid flashing "no products" while refetching cached data)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setCurrentPage(0);
    setAllProducts([]);
    setHasMore(true);
  }, [filters]);

  // Infinite scroll observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && hasMore && !isFetching && !productsLoading) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore, isFetching, productsLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0.1
    });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    const saved = localStorage.getItem("admin_whatsapp_b2b");
    if (saved) setWhatsappNumber(saved);
  }, []);

  const handleAddToCart = (item: CartItemB2B) => {
    addItemToCart({
      productId: item.productId,
      variantId: item.variantId || null,
      sku: item.sku || '',
      nombre: item.nombre,
      quantity: item.cantidad,
      unitPrice: item.precio_b2b,
      moq: item.moq,
      stockDisponible: item.stock_fisico
    });
  };

  const handleSortChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: value as B2BFilters["sortBy"]
    }));
  };

  const handleStockFilterChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      stockStatus: value as B2BFilters["stockStatus"]
    }));
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p>{t('b2bCatalog.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 pb-4 pt-0">
        {/* Hero Carousel (Mobile Only) */}
        {isMobile && featuredProducts.length > 0 && (
          <div className="mb-0 -mx-4">
            <FeaturedProductsCarousel products={featuredProducts} />
          </div>
        )}

        {/* Encabezado Desktop */}
        {!isMobile && (
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('b2bCatalog.title')}</h1>
            <p className="text-gray-600">
              {t('b2bCatalog.welcome', { name: user?.name || t('b2bCatalog.defaultSeller') })}
            </p>
          </div>
        )}

        {/* Filtros inline */}
        <div className="flex items-center gap-2 mb-1 bg-white px-3 py-1 rounded-lg border border-gray-200 overflow-x-auto">
          <span className="text-xs text-gray-500 whitespace-nowrap">{t('b2bCatalog.sort')}</span>
          <Select value={filters.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('b2bCatalog.sortNewest')}</SelectItem>
              <SelectItem value="price_asc">{t('b2bCatalog.sortPriceAsc')}</SelectItem>
              <SelectItem value="price_desc">{t('b2bCatalog.sortPriceDesc')}</SelectItem>
              <SelectItem value="moq_asc">{t('b2bCatalog.sortMoqAsc')}</SelectItem>
              <SelectItem value="moq_desc">{t('b2bCatalog.sortMoqDesc')}</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-gray-500 whitespace-nowrap">{t('b2bCatalog.stock')}</span>
          <Select value={filters.stockStatus} onValueChange={handleStockFilterChange}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('b2bCatalog.stockAll')}</SelectItem>
              <SelectItem value="in_stock">{t('b2bCatalog.stockInStock')}</SelectItem>
              <SelectItem value="low_stock">{t('b2bCatalog.stockLow')}</SelectItem>
              <SelectItem value="out_of_stock">{t('b2bCatalog.stockOut')}</SelectItem>
            </SelectContent>
          </Select>

          {(filters.searchQuery || filters.category || filters.stockStatus !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({
                searchQuery: "",
                category: null,
                stockStatus: "all",
                sortBy: "newest"
              })}
              className="text-blue-600 hover:text-blue-700 text-xs h-8 whitespace-nowrap"
            >
              {t('b2bCatalog.clearFilters')}
            </Button>
          )}
        </div>

        {/* Resultados */}
        <div className="mb-1">
          {productsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
              <p className="text-red-600 font-medium mb-2">{t('b2bCatalog.errorTitle')}</p>
              <p className="text-sm text-red-500">{productsError.message}</p>
              <Button 
                variant="outline" 
                className="mt-4 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => window.location.reload()}
              >
                {t('b2bCatalog.retry')}
              </Button>
            </div>
          ) : (productsLoading || (isFetching && allProducts.length === 0)) ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : allProducts.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center">
              <p className="text-gray-600 mb-4">
                {t('b2bCatalog.noProducts')}
              </p>
              <Button 
                variant="outline" 
                onClick={() => setFilters({
                  searchQuery: "",
                  category: null,
                  stockStatus: "all",
                  sortBy: "newest"
                })}
              >
                {t('b2bCatalog.viewAll')}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0.5 md:gap-1">
                {allProducts.map(product => (
                  <ProductCardB2B
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    cartItem={cart.items.find(item => item.productId === product.id) ? {
                      productId: cart.items.find(item => item.productId === product.id)!.productId,
                      sku: cart.items.find(item => item.productId === product.id)!.sku,
                      nombre: cart.items.find(item => item.productId === product.id)!.nombre,
                      precio_b2b: cart.items.find(item => item.productId === product.id)!.unitPrice,
                      moq: cart.items.find(item => item.productId === product.id)!.moq,
                      stock_fisico: cart.items.find(item => item.productId === product.id)!.stockDisponible,
                      cantidad: cart.items.find(item => item.productId === product.id)!.quantity,
                      subtotal: cart.items.find(item => item.productId === product.id)!.totalPrice,
                      imagen_principal: cart.items.find(item => item.productId === product.id)!.imagen
                    } : undefined}
                    whatsappNumber={whatsappNumber}
                  />
                ))}
              </div>

              {/* Load more section */}
              <div ref={loadMoreRef} className="flex flex-col items-center gap-1 py-0.5">
                {!hasMore && !isFetching && allProducts.length > 0 && (
                  <p className="text-xs text-gray-500">{t('b2bCatalog.showingAll', { count: allProducts.length })}</p>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Carrito Flotante */}
      <CartSidebarB2B
        cart={{
          items: cart.items.map(item => ({
            productId: item.productId,
            sku: item.sku,
            nombre: item.nombre,
            precio_b2b: item.unitPrice,
            moq: item.moq,
            stock_fisico: item.stockDisponible,
            cantidad: item.quantity,
            subtotal: item.totalPrice,
            imagen_principal: item.imagen,
            variantId: item.variantId || undefined
          })),
          totalItems: cart.items.length,
          totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: cart.items.reduce((sum, item) => sum + item.totalPrice, 0)
        }}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        isOpen={isCartOpen}
        onToggle={() => setIsCartOpen(!isCartOpen)}
      />

      <Footer />
    </div>
  );
};

export default SellerAcquisicionLotes;