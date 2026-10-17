import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useCategoryBySlug } from "@/hooks/useQueriesCategories";
import { useProductsByCategory } from "@/hooks/useProducts";
import { usePublicCategories } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import ProductCard from "@/components/landing/ProductCard";

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

  const { data: productsData, isLoading: isProductsLoading } = useProductsByCategory(
    categoryId,
    currentPage - 1,
    ITEMS_PER_PAGE
  );

  const products: AnyProduct[] = productsData?.products || [];
  const total = productsData?.total || 0;
  
  // Calculate visible products count based on user role
  const isB2BUser = role === UserRole.ADMIN || role === UserRole.SELLER;
  const visibleProductsCount = !isB2BUser 
    ? products.filter((p: any) => p.precio_sugerido_venta != null && p.precio_sugerido_venta > 0).length
    : total;
  
  const totalPages = Math.max(1, Math.ceil(visibleProductsCount / ITEMS_PER_PAGE));

  const isLoading = isCategoryLoading || isProductsLoading;
  const { data: allCategories = [] } = usePublicCategories();

  const subcategories = allCategories.filter((c: any) => c.parent_id === categoryId);

  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState<number | undefined>(undefined);
  const [priceMax, setPriceMax] = useState<number | undefined>(undefined);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Filter products based on user role
    // Only sellers/admins can see products from the B2B catalog
    if (!isB2BUser) {
      // For non-B2B users, only show products that have a suggested retail price (visible to public)
      list = list.filter((p: any) => p.precio_sugerido_venta != null && p.precio_sugerido_venta > 0);
    }

    // apply subcategory filter if selected
    if (selectedSubcategory) {
      list = list.filter((p: any) => (p.categoria_id === selectedSubcategory) || (p.subcategoria_id === selectedSubcategory));
    }

    // apply price range
    if (typeof priceMin !== "undefined") {
      list = list.filter((p: any) => (p.precio ?? p.price ?? 0) >= priceMin);
    }
    if (typeof priceMax !== "undefined") {
      list = list.filter((p: any) => (p.precio ?? p.price ?? 0) <= priceMax);
    }

    // sorting
    switch (filters.sortBy) {
      case "price_asc":
        return list.sort((a: any, b: any) => (a.precio ?? 0) - (b.precio ?? 0));
      case "price_desc":
        return list.sort((a: any, b: any) => (b.precio ?? 0) - (a.precio ?? 0));
      case "rating":
        return list.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0));
      case "newest":
      default:
        return list;
    }
  }, [products, filters.sortBy, selectedSubcategory, priceMin, priceMax, isB2BUser]);

  const handleViewStore = (sellerId: string) => navigate(`/tienda/${sellerId}`);

  const getSku = (p: AnyProduct) => p.sku_interno ?? p.sku ?? p.id;
  const getName = (p: AnyProduct) => p.nombre ?? p.name ?? "Producto";
  const getPrice = (p: AnyProduct) => p.precio ?? 0;  // B2C price (default Supabase field)
  const getImage = (p: AnyProduct) => p.imagen_principal ?? (p.galeria_imagenes && p.galeria_imagenes[0]) ?? p.image ?? "https://via.placeholder.com/400x500?text=Sin+imagen";
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
            <span className="capitalize">{category?.name ?? slug?.replace("-", " ")}</span>
          </div>
        </div>

        {/* Category Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 capitalize mb-1">{category?.name ?? slug}</h1>
          <p className="text-sm text-gray-600">{visibleProductsCount} productos disponibles</p>
        </div>

        {/* Compact Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Dropdown */}
            <select 
              value={filters.sortBy} 
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as FilterOptions["sortBy"] })}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Más Nuevo</option>
              <option value="price_asc">Precio: Menor a Mayor</option>
              <option value="price_desc">Precio: Mayor a Menor</option>
              <option value="rating">Mejor Valorado</option>
            </select>

            {/* Price Range Compact */}
            <div className="flex items-center gap-1">
              <label className="text-sm text-gray-600">Precio:</label>
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

            {/* Subcategories Dropdown */}
            {subcategories.length > 0 && (
              <select 
                value={selectedSubcategory ?? ""} 
                onChange={(e) => { setSelectedSubcategory(e.target.value || null); setCurrentPage(1); }}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las subcategorías</option>
                {subcategories.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {/* Clear Filters */}
            {(priceMin || priceMax || selectedSubcategory) && (
              <button 
                onClick={() => { 
                  setPriceMin(undefined); 
                  setPriceMax(undefined); 
                  setSelectedSubcategory(null); 
                  setCurrentPage(1); 
                }}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Products Grid */}
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
