import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/landing/HeroSection";
import ProductCarousel from "@/components/landing/ProductCarousel";
import CategoryGrid from "@/components/landing/CategoryGrid";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePublicCategories } from "@/hooks/useCategories";
import { useMemo } from "react";
import {
  useFeaturedProducts,
  useBestSellers,
  useNewArrivals,
  useTopStores,
  useProductsByCategory,
} from "@/hooks/useMarketplaceData";
import { Store } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const isMobile = useIsMobile();
  const { data: categories } = usePublicCategories();

  // Fetch marketplace data from database
  const { data: featuredProducts = [], isLoading: loadingFeatured } = useFeaturedProducts(10);
  const { data: bestSellers = [], isLoading: loadingBestSellers } = useBestSellers(10);
  const { data: newArrivals = [], isLoading: loadingNewArrivals } = useNewArrivals(10);
  const { data: topStores = [] } = useTopStores(6);

  // Get root categories for category-based product carousels
  const rootCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(c => !c.parent_id).slice(0, 4);
  }, [categories]);

  return (
    <div className="min-h-screen bg-background w-full">
      {!isMobile && <GlobalHeader />}
      
      <main className={`w-full overflow-x-hidden ${isMobile ? 'pb-14' : ''}`}>
        <HeroSection />
        <CategoryGrid />

        {/* Productos Destacados */}
        <ProductCarousel
          title="Productos destacados"
          products={featuredProducts}
          itemsPerView={5}
          isLoading={loadingFeatured}
        />

        {/* Más Vendidos */}
        {bestSellers.length > 0 && (
          <ProductCarousel
            title="Más vendidos"
            products={bestSellers}
            itemsPerView={5}
            isLoading={loadingBestSellers}
          />
        )}

        {/* Nuevos Productos */}
        {newArrivals.length > 0 && (
          <ProductCarousel
            title="Recién llegados"
            products={newArrivals}
            itemsPerView={5}
            isLoading={loadingNewArrivals}
          />
        )}

        {/* Top Tiendas */}
        {topStores.length > 0 && (
          <section className="py-6 px-4">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold">Tiendas destacadas</h2>
                <Link to="/trends" className="text-sm text-primary hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {topStores.map((store) => (
                  <Link 
                    key={store.id} 
                    to={`/tienda/${store.slug}`}
                    className="flex-shrink-0 transition-transform hover:scale-105"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-muted overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                      {store.logo ? (
                        <img 
                          src={store.logo} 
                          alt={store.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Products by Category */}
        {rootCategories.map(category => (
          <CategoryProductsSection 
            key={category.id} 
            categoryId={category.id}
            categoryName={category.name}
            categorySlug={category.slug}
          />
        ))}
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

// Separate component for category products to avoid conditional hook calls
const CategoryProductsSection = ({ 
  categoryId, 
  categoryName, 
  categorySlug 
}: { 
  categoryId: string; 
  categoryName: string; 
  categorySlug: string;
}) => {
  const { data: products = [], isLoading } = useProductsByCategory(categoryId, 10);

  if (!isLoading && products.length === 0) {
    return null;
  }

  return (
    <ProductCarousel
      title={categoryName}
      products={products}
      itemsPerView={5}
      linkTo={`/categoria/${categorySlug}`}
      isLoading={isLoading}
    />
  );
};

export default Index;
