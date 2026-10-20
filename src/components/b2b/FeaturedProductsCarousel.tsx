import { ProductB2BCard } from '@/types/b2b';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { useRef } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslatedList } from '@/hooks/useTranslatedContent';

interface FeaturedProductsCarouselProps {
  products: (Pick<ProductB2BCard, 'id' | 'sku' | 'nombre' | 'imagen_principal' | 'precio_b2b'> & { sponsored?: boolean })[];
  showSponsoredLabel?: boolean;
  sponsoredLabel?: string;
}

const FeaturedProductsCarousel = ({
  products,
  showSponsoredLabel = false,
  sponsoredLabel = 'Kizkka',
}: FeaturedProductsCarouselProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const autoplayPlugin = useRef(Autoplay({
    delay: 3000,
    stopOnInteraction: false,
    stopOnMouseEnter: true
  }));
  const [emblaRef] = useEmblaCarousel({
    align: 'start',
    loop: true
  }, [autoplayPlugin.current]);

  const { getTranslated } = useTranslatedList(
    'product',
    products,
    (p) => ({ name: p.nombre })
  );
  
  if (products.length === 0) return null;
  
  return <div className="w-full border-b border-border bg-background py-1.5">
      <div className="w-full px-1.5 md:container md:mx-auto md:px-4">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-1.5">
            {products.map(product => <div className="flex-[0_0_23%] min-w-[84px] max-w-[130px] cursor-pointer" key={product.id} onClick={() => navigate(`/producto/${product.sku}`)}>
                <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  <img src={product.imagen_principal} alt={getTranslated(product).name || product.nombre} className="h-full w-full object-cover" loading="lazy" />
                  {showSponsoredLabel && <span className="absolute left-1 top-1 rounded bg-background/85 px-1 text-[9px] font-medium text-muted-foreground">{product.sponsored ? 'Ad' : sponsoredLabel}</span>}
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] leading-tight text-foreground">
                  {getTranslated(product).name || product.nombre}
                </p>
                <p className="text-xs font-bold text-price leading-tight">
                  ${product.precio_b2b.toFixed(2)}
                </p>
              </div>)}
          </div>
        </div>
      </div>
    </div>;
};

export default FeaturedProductsCarousel;