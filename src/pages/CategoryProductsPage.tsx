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
import { useTranslatedContent } from "@/hooks/useTranslatedContent";

type AnyProduct = Record<string, any>;

type FilterOptions = {
  sortBy: "newest" | "price_asc" | "price_desc" | "rating";
  priceRange: [number, number];
};

const CategoryProductsPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
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
    100
  );

  // Unify product list based on user type
  const products: AnyProduct[] = isB2BUser 
    ? (productsData?.products || [])
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
    if (!isB2BUser) {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      list = list.slice(start, start + ITEMS_PER_PAGE);
    }

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
  const handleViewStore = (sellerId: string) => navigate(`/tienda/${sellerId}`);

  const getSku = (p: AnyProduct) => p.sku_interno ?? p.sku ?? p.id;
  const getName = (p: AnyProduct) => p.nombre ?? p.name ?? "Producto";
  const getPrice = (p: AnyProduct) => p.precio ?? 0;  // B2C price (default Supabase field)
  const getImage = (p: AnyProduct) => p.imagen ?? (p.galeria_imagenes && p.galeria_imagenes[0]) ?? p.image ?? "https://via.placeholder.com/400x500?text=Sin+imagen";
  const getSeller = (p: AnyProduct) => p.vendedor ?? p.seller ?? { id: "", nombre: "Tienda" };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {!isMobile && <GlobalHeader />}
        <main className={`container mx-auto px-4 ${isMobile ? 'pb-20' : 'pb-8'}`}>
          <h1 className="text-3xl font-bold mb-8">Cargando...</h1>
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
        {/* Breadcrumb */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={() => navigate("/")} className="hover:text-blue-600">Inicio</button>
            <ChevronRight className="w-4 h-4" />
            <button onClick={() => navigate("/categorias")} className="hover:text-blue-600">Categorías</button>
            <ChevronRight className="w-4 h-4" />
            <span className="capitalize">{displayCategoryName ?? slug?.replace("-", " ")}</span>
          </div>
        </div>

        {/* Category Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 capitalize mb-1">{displayCategoryName ?? slug}</h1>
          <p className="text-sm text-gray-600">{visibleProductsCount} productos disponibles</p>
        </div>

        {/* Compact Filters Bar */}
        {/* Filters Bar - Responsive */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-2">
            {/* Row 1: Primary Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full">
              {/* Sort Dropdown */}
              <select 
                value={filters.sortBy} 
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as FilterOptions["sortBy"] })}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-fit"
              >
                <option value="newest">Más Nuevo</option>
                <option value="price_asc">Precio: ↑</option>
                <option value="price_desc">Precio: ↓</option>
                <option value="rating">⭐ Rating</option>
              </select>

              {/* Price Range Compact */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">Precio:</span>
                <input 
                  type="number" 
                  placeholder="Mín" 
                  value={priceMin ?? ""}
                  onChange={(e) => { setPriceMin(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <span className="text-gray-400">-</span>
                <input 
                  type="number" 
                  placeholder="Máx" 
                  value={priceMax ?? ""}
                  onChange={(e) => { setPriceMax(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>

              {/* More Filters Button */}
              <button 
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 transition"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Row 2: Secondary Filters (shown when expanded) */}
            {showMoreFilters && (
              <div className="flex flex-wrap items-center gap-2 w-full">
                {/* Subcategories Dropdown */}
                {subcategories.length > 0 && (
                  <select 
                    value={selectedSubcategory ?? ""} 
                    onChange={(e) => { setSelectedSubcategory(e.target.value || null); setCurrentPage(1); }}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas</option>
                    {subcategories.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}

                {/* Rating Filter */}
                <select 
                  value={minRating ?? ""} 
                  onChange={(e) => { setMinRating(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Rating</option>
                  <option value="4">⭐ 4+</option>
                  <option value="3">⭐ 3+</option>
                  <option value="2">⭐ 2+</option>
                </select>

                {/* Promo Filter */}
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 px-2 py-1.5 rounded">
                  <input 
                    type="checkbox" 
                    checked={onlyPromo}
                    onChange={(e) => { setOnlyPromo(e.target.checked); setCurrentPage(1); }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span>Promociones</span>
                </label>

                {/* Stock Filter */}
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 px-2 py-1.5 rounded">
                  <input 
                    type="checkbox" 
                    checked={inStockOnly}
                    onChange={(e) => { setInStockOnly(e.target.checked); setCurrentPage(1); }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span>En Stock</span>
                </label>

                {/* Clear Filters */}
                {(priceMin || priceMax || selectedSubcategory || minRating || onlyPromo || inStockOnly) && (
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
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-12">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Anterior</button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`px-4 py-2 rounded-lg ${currentPage === i + 1 ? "bg-blue-600 text-white" : "border border-gray-300 hover:bg-gray-50"}`}>{i + 1}</button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Siguiente</button>
          </div>
        )}
      </main>

      {!isMobile && <Footer />}
    </div>
  );
};

export default CategoryProductsPage;
