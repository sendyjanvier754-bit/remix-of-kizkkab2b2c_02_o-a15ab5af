import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useSellerProducts } from "@/hooks/useSellerProducts";
import { usePublicCategories } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSmartCart } from "@/hooks/useSmartCart";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Store, Search, Package, Grid3X3, X, SlidersHorizontal } from "lucide-react";
import VariantDrawer from "@/components/products/VariantDrawer";
import useVariantDrawerStore from "@/stores/useVariantDrawerStore";

const MarketplacePage = () => {
  const isMobile = useIsMobile();
  const {
    data: products,
    isLoading
  } = useSellerProducts(100);
  const {
    data: categories = []
  } = usePublicCategories();
  const { addToCart, isB2BUser } = useSmartCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [showOnlyStock, setShowOnlyStock] = useState(false);
  const [showOnlyPromos, setShowOnlyPromos] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);

  // Get root categories
  const rootCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);

  // Get unique stores from products
  const stores = products ? Array.from(new Map(products.filter(p => p.store).map(p => [p.store!.id, p.store!])).values()) : [];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(product => {
      const matchesSearch = product.nombre.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStore = selectedStore === "all" || product.store?.id === selectedStore;
      const productPrice = product.precio_venta;
      const matchesPrice = (!minPrice || productPrice >= minPrice) && (!maxPrice || productPrice <= maxPrice);
      const matchesStock = !showOnlyStock || (product.stock && product.stock > 0);
      const matchesPromo = !showOnlyPromos || ((product as any).promo_active && (product as any).precio_promocional);
      const matchesRating = !(product as any).rating || (product as any).rating >= minRating;

      // Category filter - check if product category matches selected or is child of selected
      let matchesCategory = selectedCategory === "all";
      if (!matchesCategory && product.source_product?.categoria_id) {
        const productCategoryId = product.source_product.categoria_id;
        // Check direct match
        if (productCategoryId === selectedCategory) {
          matchesCategory = true;
        } else {
          // Check if it's a child category
          const childCategories = categories.filter(c => c.parent_id === selectedCategory);
          matchesCategory = childCategories.some(c => c.id === productCategoryId);
        }
      }
      return matchesSearch && matchesStore && matchesCategory && matchesPrice && matchesStock && matchesPromo && matchesRating;
    }).sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return a.precio_venta - b.precio_venta;
        case "price-desc":
          return b.precio_venta - a.precio_venta;
        case "name":
          return a.nombre.localeCompare(b.nombre);
        default:
          return 0;
      }
    });
  }, [products, searchQuery, selectedStore, selectedCategory, sortBy, categories, minPrice, maxPrice, showOnlyStock, showOnlyPromos, minRating]);
  const handleAddToCart = (product: typeof products[0]) => {
    const mainImage = Array.isArray(product.images) ? product.images[0] : (product.images || '');
    useVariantDrawerStore.getState().open({
      id: product.id,
      sku: product.sku,
      nombre: product.nombre,
      images: mainImage ? [mainImage] : [],
      price: product.precio_venta,
      costB2B: product.source_product?.precio_mayorista || product.precio_venta,
      moq: product.source_product?.moq || 1,
      stock: product.stock || 0,
      source_product_id: product.source_product?.id,
    });
  };
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStore("all");
    setSelectedCategory("all");
    setSortBy("newest");
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setShowOnlyStock(false);
    setShowOnlyPromos(false);
    setMinRating(0);
  };
  const hasActiveFilters = searchQuery || selectedStore !== "all" || selectedCategory !== "all" || minPrice || maxPrice || showOnlyStock || showOnlyPromos || minRating > 0;
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isMobile && <Header />}
      
      <main className={`flex-1 container mx-auto px-4 py-6 ${isMobile ? 'pb-20' : ''}`}>
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Adquisición de Lotes</h1>
        </div>

        {/* Compact Filter Bar */}
        <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
          <div className="flex flex-col md:flex-row gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar productos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 text-sm h-9" />
            </div>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[140px] h-9 text-sm px-2">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Más Nuevo</SelectItem>
                <SelectItem value="price-asc">Precio ↑</SelectItem>
                <SelectItem value="price-desc">Precio ↓</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Button with Drawer */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
              className="h-9"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Additional Filters Drawer */}
          {showFiltersDrawer && (
            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Price Range */}
              <div className="space-y-2">
                <label className="text-xs font-medium">Precio mínimo</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={minPrice ?? ""}
                  onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Precio máximo</label>
                <Input
                  type="number"
                  placeholder="9999"
                  value={maxPrice ?? ""}
                  onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Stock Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stock-filter"
                  checked={showOnlyStock}
                  onChange={(e) => setShowOnlyStock(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="stock-filter" className="text-sm font-medium cursor-pointer">
                  Solo con stock
                </label>
              </div>

              {/* Promo Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="promo-filter"
                  checked={showOnlyPromos}
                  onChange={(e) => setShowOnlyPromos(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="promo-filter" className="text-sm font-medium cursor-pointer">
                  Solo promociones
                </label>
              </div>

              {/* Rating Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium">Calificación mínima</label>
                <Select value={minRating.toString()} onValueChange={(val) => setMinRating(Number(val))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Todas</SelectItem>
                    <SelectItem value="3">3+ estrellas</SelectItem>
                    <SelectItem value="4">4+ estrellas</SelectItem>
                    <SelectItem value="5">5 estrellas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Store Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium">Tienda</label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Button */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs col-span-full">
                  <X className="h-3 w-3 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">No hay productos disponibles</p>
            <p className="text-muted-foreground text-sm mb-4">
              {hasActiveFilters ? "Intenta ajustar los filtros de búsqueda" : "Los vendedores aún no han publicado productos"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filteredProducts.map(product => {
              const images = product.images as any;
              const mainImage = Array.isArray(images) && images.length > 0 ? images[0] : typeof images === 'string' ? images : '';
              return (
                <div key={product.id} className="bg-card rounded-lg overflow-hidden hover:shadow-lg transition group border border-border">
                  {/* Image */}
                  <Link to={`/producto/${product.sku}`} className="block">
                    <div className="relative aspect-square bg-muted overflow-hidden">
                      {mainImage ? (
                        <img src={mainImage} alt={product.nombre} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Category Badge */}
                      {product.source_product?.category && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-primary/90 text-primary-foreground text-[10px] rounded">
                          {product.source_product.category.name}
                        </div>
                      )}
                      
                      {/* Store Badge */}
                      {product.store && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-[10px] rounded flex items-center gap-1">
                          <Store className="h-3 w-3" />
                          {product.store.name}
                        </div>
                      )}
                      
                      {/* Stock Badge */}
                      {product.stock <= 0 && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-destructive text-destructive-foreground text-xs rounded font-medium">
                          Agotado
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="p-3">
                    <Link to={`/producto/${product.sku}`}>
                      <h3 className="text-sm font-medium text-foreground line-clamp-1 mb-1 hover:text-primary transition">
                        {product.nombre}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-primary">
                        ${product.precio_venta.toFixed(2)}
                      </span>
                      {product.stock > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Stock: {product.stock}
                        </span>
                      )}
                    </div>

                    <Button onClick={() => handleAddToCart(product)} disabled={product.stock <= 0} size="sm" className="w-full">
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Variant Drawer */}
      <VariantDrawer />

      {!isMobile && <Footer />}
    </div>
  );
};

export default MarketplacePage;