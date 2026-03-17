import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMarketplaceBanners } from "@/hooks/useMarketplaceData";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

// Default banners as fallback when no database banners exist
const defaultBanners = [
  {
    id: "default-1",
    title: "Bienvenido a Siver",
    image_url: "/navidad-1.png",
    link_url: "/marketplace",
    fallback: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=400&fit=crop",
  },
  {
    id: "default-2",
    title: "Explora Nuestras Ofertas",
    image_url: "/navidad-2.png",
    link_url: "/marketplace",
    fallback: "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=1200&h=400&fit=crop",
  },
  {
    id: "default-3",
    title: "Nuevos Productos",
    image_url: "/navidad-3.png",
    link_url: "/marketplace",
    fallback: "https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=1200&h=400&fit=crop",
  },
];

const HeroSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: dbBanners, isLoading } = useMarketplaceBanners();
  const isMobile = useIsMobile();

  // Filter banners by device target, then pick correct image per device
  const slides = dbBanners && dbBanners.length > 0
    ? dbBanners
        .filter((b) => {
          const dt = (b as { device_target?: string }).device_target ?? 'all';
          return dt === 'all' || dt === (isMobile ? 'mobile' : 'desktop');
        })
        .map(b => {
          const desktopImg = (b as { desktop_image_url?: string | null }).desktop_image_url;
          const useDesktop = !isMobile && !!desktopImg;
          const bPos = b as { mobile_position_x?: number; mobile_position_y?: number; mobile_scale?: number; desktop_position_x?: number; desktop_position_y?: number; desktop_scale?: number };
          const px = useDesktop ? (bPos.desktop_position_x ?? 50) : (bPos.mobile_position_x ?? 50);
          const py = useDesktop ? (bPos.desktop_position_y ?? 50) : (bPos.mobile_position_y ?? 50);
          const scale = useDesktop ? (bPos.desktop_scale ?? 100) : (bPos.mobile_scale ?? 100);
          return {
            id: b.id,
            title: b.title,
            image_url: useDesktop ? desktopImg! : b.image_url,
            link_url: b.link_url,
            fallback: "/placeholder.svg",
            objectPosition: `${px}% ${py}%`,
            objectScale: scale / 100,
            objectOrigin: `${px}% ${py}%`,
          };
        })
    : defaultBanners;

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  useEffect(() => {
    if (slides.length === 0) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Reset slide when banners change
  useEffect(() => {
    if (currentSlide >= slides.length) {
      setCurrentSlide(0);
    }
  }, [slides.length, currentSlide]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  const handleSlideClick = (linkUrl: string | null) => {
    if (linkUrl) {
      window.location.href = linkUrl;
    }
  };

  if (isLoading) {
    return (
      <section className="relative w-full h-48 sm:h-64 md:h-80 lg:h-[24rem] xl:h-[28rem] 2xl:h-[32rem] overflow-hidden">
        <Skeleton className="w-full h-full" />
      </section>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <section 
      ref={containerRef}
      className="relative w-full h-48 sm:h-64 md:h-80 lg:h-[24rem] xl:h-[28rem] 2xl:h-[32rem] overflow-hidden touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Carousel Container */}
      <div className="relative w-full h-full">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-500 cursor-pointer ${
              index === currentSlide ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={() => handleSlideClick(slide.link_url)}
          >
            <img
              src={slide.image_url}
              alt={slide.title}
              className="w-full h-full object-cover"
              style={{
                objectPosition: (slide as { objectPosition?: string }).objectPosition ?? '50% 50%',
                transform: `scale(${(slide as { objectScale?: number }).objectScale ?? 1})`,
                transformOrigin: (slide as { objectOrigin?: string }).objectOrigin ?? '50% 50%',
              }}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                // try fallback then placeholder
                if (slide.fallback && img.src !== slide.fallback) {
                  img.src = slide.fallback;
                } else if (!img.src.includes("/placeholder.svg")) {
                  img.src = "/placeholder.svg";
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows - smaller on mobile */}
      {slides.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
            className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/30 hover:bg-white/50 p-1.5 sm:p-2 rounded-full transition"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
            className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/30 hover:bg-white/50 p-1.5 sm:p-2 rounded-full transition"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
          </button>
        </>
      )}

      {/* Dots - smaller on mobile */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-1.5 sm:gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={(e) => { e.stopPropagation(); goToSlide(index); }}
              className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition ${
                index === currentSlide ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroSection;
