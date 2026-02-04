import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, X } from "lucide-react";
import { usePublicCategories } from "@/hooks/useCategories";
import { useTrendingProducts } from "@/hooks/useTrendingProducts";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SellerDesktopHeader from "@/components/seller/SellerDesktopHeader";
import SellerMobileHeader from "@/components/seller/SellerMobileHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import FeaturedCarousel from "@/components/shared/FeaturedCarousel";
import TrendingStoresSection from "@/components/trends/TrendingStoresSection";
import TrendingCategoriesSection from "@/components/trends/TrendingCategoriesSection";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
const TrendsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    role,
    user,
    isLoading: authLoading
  } = useAuth();
  const {
    data: categories,
    isLoading: categoriesLoading
  } = usePublicCategories();
  const {
    data: trendingProducts,
    isLoading: trendingLoading
  } = useTrendingProducts(7, 20);
  
  // Determinar si es seller o admin
  const isSeller = Boolean(user && role && (role === UserRole.SELLER || role === UserRole.ADMIN));
  const isB2B = isSeller;

  // States for seller header
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState<string>("trending");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Calculate max price from trending products
  const maxPrice = useMemo(() => {
    if (!trendingProducts) return 1000;
    return Math.max(...trendingProducts.map(p => p.precio_sugerido_venta || p.precio_mayorista || 0), 1000);
  }, [trendingProducts]);

  // Get filtered and sorted trending products
  const filteredTrendingProducts = useMemo(() => {
    let products = trendingProducts || [];

    // Filter by category
    if (selectedCategory !== "all") {
      products = products.filter(p => p.categoria_id === selectedCategory);
    }

    // Filter by price range
    products = products.filter(p => {
      const price = p.precio_sugerido_venta || p.precio_mayorista;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Sort
    if (sortBy === "price-low") {
      products = [...products].sort((a, b) => (a.precio_sugerido_venta || a.precio_mayorista) - (b.precio_sugerido_venta || b.precio_mayorista));
    } else if (sortBy === "price-high") {
      products = [...products].sort((a, b) => (b.precio_sugerido_venta || b.precio_mayorista) - (a.precio_sugerido_venta || a.precio_mayorista));
    }

    return products;
  }, [trendingProducts, selectedCategory, priceRange, sortBy]);

  const clearFilters = () => {
    setSelectedCategory("all");
    setPriceRange([0, maxPrice]);
    setSortBy("trending");
  };
  const hasActiveFilters = selectedCategory !== "all" || priceRange[0] > 0 || priceRange[1] < maxPrice;
  const FilterControls = () => <div className="space-y-6">
      {/* Category Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories?.filter(c => !c.parent_id).map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Price Range Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rango de Precio: ${priceRange[0]} - ${priceRange[1]}
        </label>
        <Slider value={priceRange} onValueChange={value => setPriceRange(value as [number, number])} min={0} max={maxPrice} step={10} className="mt-2" />
      </div>

      {/* Sort */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Ordenar por</label>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">Más populares</SelectItem>
            <SelectItem value="price-low">Precio: Menor a Mayor</SelectItem>
            <SelectItem value="price-high">Precio: Mayor a Menor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && <Button variant="outline" onClick={clearFilters} className="w-full">
          <X className="w-4 h-4 mr-2" />
          Limpiar Filtros
        </Button>}
    </div>;

  // Featured products for carousel
  const featuredProducts = useMemo(() => {
    return (trendingProducts || []).slice(0, 8).map(p => ({
      id: p.id,
      sku: p.sku_interno,
      nombre: p.nombre,
      precio: p.precio_sugerido_venta || p.precio_b2b,
      imagen_principal: p.imagen_principal || '/placeholder.svg',
      stock: p.stock_status === 'out_of_stock' ? 0 : 1,
      moq: 1
    }));
  }, [trendingProducts]);
  // Si auth está cargando, no renderizar header hasta que se sepa el rol
  const showSellerHeader = !authLoading && isSeller;
  const showClientHeader = !authLoading && !isSeller;

  return <div className="min-h-screen bg-gray-50">
      {/* Header según el rol */}
      {showSellerHeader ? (
        isMobile ? (
          <SellerMobileHeader
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={setSelectedCategoryId}
            onSearch={setSearchQuery}
          />
        ) : (
          <SellerDesktopHeader
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={setSelectedCategoryId}
            onSearch={setSearchQuery}
          />
        )
      ) : showClientHeader ? (
        !isMobile && <Header />
      ) : null}

      {/* Featured Carousel - Mobile Only */}
      {isMobile && featuredProducts.length > 0 && <div className={isSeller ? "pt-2" : "pt-2"}>
          <FeaturedCarousel products={featuredProducts} showMoq={isB2B} />
        </div>}
      
      {/* Hero Section */}
      

      <div className={`container mx-auto px-4 py-12 ${isMobile ? 'pb-20' : ''} ${isSeller && !isMobile ? 'pt-4' : ''}`}>
        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white p-4 rounded-lg shadow-sm">
          {/* Desktop Filters */}
          <div className="hidden md:flex items-center gap-4 flex-1">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories?.filter(c => !c.parent_id).map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trending">Más populares</SelectItem>
                <SelectItem value="price-low">Menor precio</SelectItem>
                <SelectItem value="price-high">Mayor precio</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Precio:</span>
              <div className="w-48">
                <Slider value={priceRange} onValueChange={value => setPriceRange(value as [number, number])} min={0} max={maxPrice} step={10} />
              </div>
              <span className="text-xs">${priceRange[0]}-${priceRange[1]}</span>
            </div>
          </div>

          {/* Mobile Filter Button */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filtros
                {hasActiveFilters && <span className="w-2 h-2 bg-[#071d7f] rounded-full" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterControls />
              </div>
            </SheetContent>
          </Sheet>

          {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
              <X className="w-4 h-4 mr-1" />
              Limpiar
            </Button>}

          <div className="text-sm text-gray-500">
            {filteredTrendingProducts.length} productos
          </div>
        </div>

        <div className="space-y-16">
          {/* Trending Stores Section */}
          <TrendingStoresSection />

          {/* Trending Categories Section */}
          <TrendingCategoriesSection />
        </div>
      </div>
      {!isMobile && !isSeller && <Footer />}
    </div>;
};
export default TrendsPage;