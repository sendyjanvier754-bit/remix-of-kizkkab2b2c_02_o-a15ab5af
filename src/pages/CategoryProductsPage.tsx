import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useCategoryBySlug } from "@/hooks/useQueriesCategories";
import { useProductsByCategory } from "@/hooks/useProducts";
import { usePublicCategories } from "@/hooks/useCategories";
import { useSellerProductsByCategory } from "@/hooks/useSellerProducts";
import { useIsMobile } from "@/hooks/use-mobile";
import ProductCard from "@/components/landing/ProductCard";
import FeaturedProductsCarousel from "@/components/b2b/FeaturedProductsCarousel";
import { useTranslatedContent, useTranslatedList } from "@/hooks/useTranslatedContent";
import { useTranslation } from "react-i18next";

type AnyProduct = Record<string, any>;

type FilterOptions = {
  sortBy: "newest" | "price_asc" | "price_desc" | "rating";
  priceRange: [number, number];
};

const CategoryProductsPage = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 2000;
  const [filters, setFilters] = useState<FilterOptions>({ sortBy: "newest", priceRange: [0, 1000] });

  const { data: category, isLoading: isCategoryLoading } = useCategoryBySlug(slug);
  const categoryId = category?.id ?? null;
  const isB2BUser = role === UserRole.ADMIN || role === UserRole.SELLER;
  const { data: allCategories = [] } = usePublicCategories();

  // Translation hook for category name
  const translatedCategory = useTranslatedContent(
    'category',
    categoryId || '',
    category ? { name: category.name } : { name: '' }
  );
  const displayCategoryName = translatedCategory.translated.name || category?.name;

  // B2B users: fetch from products table
  const { data: productsData, isLoading: isProductsLoading } = useProductsByCategory(
    isB2BUser ? categoryId : null,
    currentPage - 1,
    ITEMS_PER_PAGE
  );

  // B2C users: fetch from seller_catalog
  const { data: sellerProducts = [], isLoading: isSellerLoading } = useSellerProductsByCategory(
    !isB2BUser ? (categoryId ?? undefined) : undefined,
    allCategories,
    2000
  );

  // Unify product list based on user type
  const products: AnyProduct[] = isB2BUser 
    ? (productsData?.products || []).map((p: any) => ({
        ...p,
        // Map B2B wholesale price to the fields ProductCard expects
        precio: p.precio_mayorista_base ?? p.precio ?? 0,
        precio_mayorista: p.precio_mayorista_base ?? 0,
        precio_b2c: p.precio_sugerido_venta ?? p.precio_mayorista_base ?? 0,
        vendedor: { id: "", nombre: t('pagesExtra.categoryProducts.defaultStoreName') },
      }))
    : sellerProducts.map((sp: any) => ({
        id: sp.id,
        sku_interno: sp.sku,
        sku: sp.sku,
        nombre: sp.nombre,
        descripcion_corta: sp.descripcion,
        precio: sp.precio_venta,
        precio_b2c: sp.precio_venta,
        precio_mayorista: sp.source_product?.precio_mayorista_base || sp.precio_costo || 0,
        precio_sugerido_venta: sp.precio_venta,
        imagen_principal: Array.isArray(sp.images) ? sp.images[0] : sp.images,
        galeria_imagenes: Array.isArray(sp.images) ? sp.images : [],
        stock_fisico: sp.stock ?? 0,
        moq: sp.source_product?.moq || 1,
        categoria_id: sp.category_id || sp.source_product?.categoria_id,
        vendedor: sp.store ? { 
          id: sp.store.id, 
          nombre: sp.store.name,
          whatsapp: sp.store.whatsapp,
          is_verified: true 
        } : { id: "", nombre: "Tienda" },
        // Keep seller catalog reference for cart
        sellerCatalogId: sp.id,
        source_product_id: sp.source_product_id,
        storeId: sp.seller_store_id,
      }));

  const total = isB2BUser ? (productsData?.total || 0) : products.length;
  
  const visibleProductsCount = isB2BUser 
    ? total
    : products.length;
  
  const totalPages = Math.max(1, Math.ceil(visibleProductsCount / ITEMS_PER_PAGE));

  const isLoading = isCategoryLoading || (isB2BUser ? isProductsLoading : isSellerLoading);

  const subcategories = allCategories.filter((c: any) => c.parent_id === categoryId);
  const { getTranslated: getSubTranslated } = useTranslatedList(
    'category',
    subcategories,
    (s: any) => ({ name: s.name })
  );

  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState<number | undefined>(undefined);
  const [priceMax, setPriceMax] = useState<number | undefined>(undefined);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // For B2B users, filter products without suggested price
    if (isB2BUser) {
      // B2B sees all products
    } else {
      // B2C products already come from seller_catalog, no additional filtering needed
    }

    // apply subcategory filter if selected
    if (selectedSubcategory) {
      list = list.filter((p: any) => (p.categoria_id === selectedSubcategory) || (p.subcategoria_id === selectedSubcategory));
    }

    // apply price range
    if (typeof priceMin !== "undefined") {
      list = list.filter((p: any) => (p.precio_b2c ?? p.precio ?? p.price ?? 0) >= priceMin);
    }
    if (typeof priceMax !== "undefined") {
      list = list.filter((p: any) => (p.precio_b2c ?? p.precio ?? p.price ?? 0) <= priceMax);
    }

    // apply rating filter
    if (typeof minRating !== "undefined" && minRating > 0) {
      list = list.filter((p: any) => (p.rating ?? 0) >= minRating);
    }

    // apply promo filter
    if (onlyPromo) {
      list = list.filter((p: any) => (p.promo_active || p.precio_promocional) && p.precio_promocional > 0);
    }

    // apply stock filter
    if (inStockOnly) {
      list = list.filter((p: any) => (p.stock_fisico ?? 0) > 0);
    }

    // Paginate for B2C (seller products come all at once)

    // sorting
    switch (filters.sortBy) {
      case "price_asc":
        return list.sort((a: any, b: any) => (a.precio_b2c ?? a.precio ?? 0) - (b.precio_b2c ?? b.precio ?? 0));
      case "price_desc":
        return list.sort((a: any, b: any) => (b.precio_b2c ?? b.precio ?? 0) - (a.precio_b2c ?? a.precio ?? 0));
      case "rating":
        return list.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0));
      case "newest":
      default:
        return list;
    }
  }, [products, filters.sortBy, selectedSubcategory, priceMin, priceMax, isB2BUser, minRating, onlyPromo, inStockOnly, currentPage]);
  const featuredProducts = useMemo(() => products
    .filter((p: any) => (p.imagen_principal || p.imagen) && (p.stock_fisico ?? 1) > 0)
    .slice(0, 12)
    .map((p: any) => ({
      id: p.id,
      sku: p.sku_interno ?? p.sku ?? p.id,
      nombre: p.nombre ?? '',
      imagen_principal: p.imagen_principal ?? p.imagen,
      precio_b2b: Number(p.precio ?? 0),
      moq: p.moq ?? 1,
      stock_fisico: p.stock_fisico ?? 1,
    })) as any[], [products]);
  const handleViewStore = (sellerId: string) => navigate(`/tienda/${sellerId}`);

  const getSku = (p: AnyProduct) => p.sku_interno ?? p.sku ?? p.id;
  const getName = (p: AnyProduct) => p.nombre ?? p.name ?? t('pagesExtra.categoryProducts.defaultProductName');
  const getPrice = (p: AnyProduct) => p.precio ?? 0;  // B2C price (default Supabase field)
  const getImage = (p: AnyProduct) => p.imagen ?? p.imagen_principal ?? (p.galeria_imagenes && p.galeria_imagenes[0]) ?? p.image ?? "https://via.placeholder.com/400x500?text=Sin+imagen";
  const getSeller = (p: AnyProduct) => p.vendedor ?? p.seller ?? { id: "", nombre: t('pagesExtra.categoryProducts.defaultStoreName') };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {!isMobile && <GlobalHeader />}
        <main className={`container mx-auto px-4 ${isMobile ? 'pb-20' : 'pb-8'}`}>
          <h1 className="text-3xl font-bold mb-8">{t('pagesExtra.categoryProducts.loading')}</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isMobile && <GlobalHeader />}

      <main className={`container mx-auto px-4 ${isMobile ? 'pb-20' : 'pb-8'}`}>
        {featuredProducts.length > 0 && (
          <div className="-mx-4 mb-2">
            <FeaturedProductsCarousel products={featuredProducts} />
          </div>
        )}

        {/* Breadcrumb + header compact */}
        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1 overflow-x-auto whitespace-nowrap">
          <button onClick={() => navigate("/")} className="hover:text-blue-600">{t('pagesExtra.categoryProducts.home')}</button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => navigate("/categorias")} className="hover:text-blue-600">{t('pagesExtra.categoryProducts.categoriesLabel')}</button>
          <ChevronRight className="w-3 h-3" />
          <span className="capitalize">{displayCategoryName ?? slug?.replace("-", " ")}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 capitalize">{displayCategoryName ?? slug}</h1>
          <p className="text-xs text-gray-600 whitespace-nowrap">{t('pagesExtra.categoryProducts.productsAvailable', { count: visibleProductsCount })}</p>
        </div>

        {/* Filters Bar - sticky pill row on mobile, panel on desktop */}
        {(() => {
          const activeCount = [priceMin, priceMax, selectedSubcategory, minRating, onlyPromo || null, inStockOnly || null].filter(Boolean).length;
          const sortLabels: Record<string, string> = {
            newest: t('pagesExtra.categoryProducts.sortNewest'),
            price_asc: t('pagesExtra.categoryProducts.sortPriceAsc'),
            price_desc: t('pagesExtra.categoryProducts.sortPriceDesc'),
            rating: t('pagesExtra.categoryProducts.sortRating'),
          };
          return (
            <div className={`${isMobile ? 'sticky top-0 z-30 -mx-4 px-4 py-2 bg-gray-50/95 backdrop-blur-sm' : 'bg-white rounded-lg border border-gray-200 px-3 py-2'} mb-3`}>
              {/* Row 1: horizontal scrollable pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {/* Sort pill */}
                <div className="relative flex-shrink-0">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as FilterOptions["sortBy"] })}
                    className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-gray-300 rounded-full text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">{sortLabels.newest}</option>
                    <option value="price_asc">{sortLabels.price_asc}</option>
                    <option value="price_desc">{sortLabels.price_desc}</option>
                    <option value="rating">{sortLabels.rating}</option>
                  </select>
                  <ChevronRight className="w-3 h-3 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>

                {/* Price range pill */}
                <div className="flex-shrink-0 flex items-center gap-1 bg-white border border-gray-300 rounded-full pl-3 pr-1.5 py-1">
                  <span className="text-xs font-medium text-gray-600">{t('pagesExtra.categoryProducts.priceLabel')}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('pagesExtra.categoryProducts.min')}
                    value={priceMin ?? ""}
                    onChange={(e) => { setPriceMin(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
                    className="w-12 px-1 py-0.5 text-xs text-center bg-gray-50 border border-gray-200 rounded-full focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-gray-400 text-xs">–</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('pagesExtra.categoryProducts.max')}
                    value={priceMax ?? ""}
                    onChange={(e) => { setPriceMax(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
                    className="w-12 px-1 py-0.5 text-xs text-center bg-gray-50 border border-gray-200 rounded-full focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Quick toggle: in stock */}
                <button
                  onClick={() => { setInStockOnly(!inStockOnly); setCurrentPage(1); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${inStockOnly ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  {t('pagesExtra.categoryProducts.inStock')}
                </button>

                {/* Quick toggle: promo */}
                <button
                  onClick={() => { setOnlyPromo(!onlyPromo); setCurrentPage(1); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${onlyPromo ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  {t('pagesExtra.categoryProducts.promotions')}
                </button>

                {/* More filters button with badge */}
                <button
                  onClick={() => setShowMoreFilters(!showMoreFilters)}
                  className={`flex-shrink-0 ml-auto relative flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition ${showMoreFilters ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {activeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-[#071d7f] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Row 2: expanded filters panel */}
              {showMoreFilters && (
                <div className="flex flex-wrap items-center gap-2 w-full mt-2 pt-2 border-t border-gray-200">
                  {/* Subcategories Dropdown */}
                  {subcategories.length > 0 && (
                    <select
                      value={selectedSubcategory ?? ""}
                      onChange={(e) => { setSelectedSubcategory(e.target.value || null); setCurrentPage(1); }}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-full text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t('pagesExtra.categoryProducts.all')}</option>
                      {subcategories.map((s: any) => (
                        <option key={s.id} value={s.id}>{getSubTranslated(s).name || s.name}</option>
                      ))}
                    </select>
                  )}

                  {/* Rating Filter */}
                  <select
                    value={minRating ?? ""}
                    onChange={(e) => { setMinRating(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-full text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('pagesExtra.categoryProducts.ratingLabel')}</option>
                    <option value="4">⭐ 4+</option>
                    <option value="3">⭐ 3+</option>
                    <option value="2">⭐ 2+</option>
                  </select>

                  {/* Clear Filters */}
                  {activeCount > 0 && (
                    <button
                      onClick={() => {
                        setPriceMin(undefined);
                        setPriceMax(undefined);
                        setSelectedSubcategory(null);
                        setMinRating(undefined);
                        setOnlyPromo(false);
                        setInStockOnly(false);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      {t('pagesExtra.categoryProducts.clear')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Products Grid - Updated with additional filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filteredProducts.map((p) => {
            const sku = getSku(p);
            const name = getName(p);
            const price = getPrice(p);
            const image = getImage(p);
            const seller = getSeller(p);

            // Transform product data to match ProductCard interface
            const productForCard = {
              id: p.id || sku,
              name: name,
              price: price,
              priceB2B: p.precio_mayorista ?? price,
              pvp: p.precio_sugerido_venta || price,
              moq: p.moq || 1,
              stock: p.stock ?? 1,
              image: image,
              sku: sku,
              storeId: seller.id,
              storeName: seller.nombre ?? seller.name,
              storeWhatsapp: seller.whatsapp,
              isSellerVerified: seller.is_verified || false,
              // Optional fields
              discount: p.discount ?? 0,
              badge: p.badge ?? p.coupon_label,
              originalPrice: p.precio_sugerido_venta || undefined,
            };

            return <ProductCard key={sku} product={productForCard} />;
          })}
        </div>

      </main>

      {!isMobile && <Footer />}
    </div>
  );
};

export default CategoryProductsPage;
