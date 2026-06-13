import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/landing/HeroSection";
import ProductCarousel from "@/components/landing/ProductCarousel";
import ProductGrid from "@/components/landing/ProductGrid";
import CategoryGrid from "@/components/landing/CategoryGrid";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";
import {
  useAllSellerProducts,
  useFeaturedProducts,
  useBestSellers,
  useNewArrivals,
} from "@/hooks/useMarketplaceData";
import { useSEO } from "@/hooks/useSEO";
import { useBranding } from "@/hooks/useBranding";

// How many products to show between each promotional section
const CHUNK_SIZE = 30;

const Index = () => {
  const isMobile = useIsMobile();
  const { getValue } = useBranding();

  useSEO({
    title: 'Kizkka · Marketplace global B2B y B2C',
    description:
      'Compra al mejor precio en Kizkka: marketplace que conecta vendedores internacionales con compradores en Haití y el Caribe, con logística integrada.',
    type: 'website',
    image: getValue('share_image_url') || getValue('logo_url') || getValue('favicon_url'),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  });

  // Main feed: all seller products mixed
  const { data: allProducts = [], isLoading: loadingAll } = useAllSellerProducts(200);

  // Interleaved promotional sections
  const { data: featuredProducts = [], isLoading: loadingFeatured } = useFeaturedProducts(10);
  const { data: bestSellers = [], isLoading: loadingBestSellers } = useBestSellers(10);
  const { data: newArrivals = [], isLoading: loadingNewArrivals } = useNewArrivals(10);

  // Split all products into chunks of CHUNK_SIZE
  const productChunks = useMemo(() => {
    const chunks: typeof allProducts[] = [];
    for (let i = 0; i < allProducts.length; i += CHUNK_SIZE) {
      chunks.push(allProducts.slice(i, i + CHUNK_SIZE));
    }
    // Always show at least one chunk placeholder when loading
    return chunks.length > 0 ? chunks : [[]];
  }, [allProducts]);

  // Sections that appear between product chunks (cycling)
  const interleaved = [
    { title: "Más vendidos", products: bestSellers, isLoading: loadingBestSellers },
    { title: "Recién llegados", products: newArrivals, isLoading: loadingNewArrivals },
    { title: "Productos destacados", products: featuredProducts, isLoading: loadingFeatured },
  ];

  return (
    <div className="min-h-screen bg-background w-full">
      {!isMobile && <GlobalHeader />}

      <main className={`w-full overflow-x-hidden ${isMobile ? 'pb-14' : ''}`}>
        <h1 className="sr-only">Kizkka — Marketplace global B2B y B2C para Haití y el Caribe</h1>
        <HeroSection />
        <CategoryGrid />

        {/* Feed: alternates between product grid chunks and promotional carousels */}
        {productChunks.map((chunk, index) => (
          <div key={index}>
            {/* Product grid chunk */}
            <ProductGrid
              products={chunk}
              isLoading={loadingAll && index === 0}
              skeletonCount={CHUNK_SIZE}
            />

            {/* Interleaved promotional section after each chunk */}
            {(() => {
              const section = interleaved[index % interleaved.length];
              if (!section.isLoading && section.products.length === 0) return null;
              return (
                <ProductCarousel
                  key={`section-${index}`}
                  title={section.title}
                  products={section.products}
                  itemsPerView={8}
                  isLoading={section.isLoading}
                />
              );
            })()}
          </div>
        ))}
      </main>

      {!isMobile && <Footer />}
    </div>
  );
};

export default Index;
