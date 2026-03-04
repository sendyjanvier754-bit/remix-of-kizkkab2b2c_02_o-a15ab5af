import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  discount?: number;
  badge?: string;
  sku: string;
  storeId?: string;
  storeName?: string;
  storeWhatsapp?: string;
  // B2B fields
  priceB2B?: number;
  moq?: number;
  stock?: number;
}

interface ProductCarouselProps {
  title: string;
  products: Product[];
  itemsPerView?: number;
  isLoading?: boolean;
  linkTo?: string;
}

const ProductCarousel = ({
  title,
  products,
  itemsPerView = 5,
  isLoading = false,
  linkTo = "/",
}: ProductCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const scroll = (direction: "left" | "right") => {
    if (direction === "left") {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    } else {
      setCurrentIndex(
        Math.min(products.length - itemsPerView, currentIndex + 1)
      );
    }
  };

  const visibleProducts = products.slice(
    currentIndex,
    currentIndex + itemsPerView
  );

  if (isLoading) {
    return (
      <section className="w-full px-0 md:px-0">
        {/* Box Container */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
          {/* Header / Section Separator */}
          <div className="hidden md:block bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-foreground truncate">
                  {title}
                </h2>
              </div>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">
                  {title}
                </h2>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-2 md:p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card rounded-lg overflow-hidden">
                  <Skeleton className="aspect-[4/5] w-full" />
                  <div className="p-2 md:p-3 space-y-1 md:space-y-2">
                    <Skeleton className="h-3 md:h-4 w-full" />
                    <Skeleton className="h-3 md:h-4 w-2/3" />
                    <Skeleton className="h-6 md:h-8 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="w-full px-4 md:px-4 overflow-hidden">
      {/* Box Container - Unified on Desktop */}
      <div className="w-full bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        {/* Desktop Header - Integrated */}
        <div className="hidden md:block bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">
                {title}
              </h2>
            </div>
            {linkTo && linkTo !== "/" && (
              <a 
                href={linkTo} 
                className="text-[#071d7f] hover:text-[#094bb8] text-sm font-medium flex items-center gap-1 whitespace-nowrap flex-shrink-0"
              >
                Ver todo
                <ChevronRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate">
                {title}
              </h2>
            </div>
            {linkTo && linkTo !== "/" && (
              <a 
                href={linkTo} 
                className="text-[#071d7f] hover:text-[#094bb8] text-xs font-medium flex items-center gap-1 whitespace-nowrap flex-shrink-0"
              >
                Ver todo
                <ChevronRight className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Carousel Container - Desktop Grid / Mobile Scroll */}
        <div className="relative bg-white">
          {/* Desktop: Grid with navigation buttons overlaid */}
          <div className="hidden md:block p-1 md:p-1.5 relative">
            {/* Left Arrow - overlaid */}
            <button
              onClick={() => scroll("left")}
              disabled={currentIndex === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed p-1.5 rounded-full transition shadow-md"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-foreground" />
            </button>

            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-1 overflow-hidden">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Right Arrow - overlaid */}
            <button
              onClick={() => scroll("right")}
              disabled={currentIndex >= products.length - itemsPerView}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed p-1.5 rounded-full transition shadow-md"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-foreground" />
            </button>
          </div>

          {/* Mobile: Horizontal scroll */}
          <div className="md:hidden p-3">
            <div className="overflow-x-auto scrollbar-hide -mx-3 px-3">
              <div className="flex gap-3 min-w-max">
                {products.map((product) => (
                  <div key={product.id} className="w-20 flex-shrink-0">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductCarousel;