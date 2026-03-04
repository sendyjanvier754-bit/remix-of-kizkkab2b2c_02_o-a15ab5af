import { ProductB2BCard } from '@/types/b2b';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface FeaturedProductsCarouselProps {
  products: ProductB2BCard[];
}

const FeaturedProductsCarousel = ({
  products
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
  
  if (products.length === 0) return null;
  
  return <div className="w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 py-0 mb-0">
      <div className="container mx-auto px-4">
        <div className="border border-gray-300 rounded-lg p-2">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4">
              {products.map(product => <div className="flex-[0_0_28%] min-w-[100px] max-w-[120px] cursor-pointer" key={product.id} onClick={() => navigate(`/producto/${product.sku}`)}>
                  <Card className="h-full border-none shadow-sm hover:shadow-md transition-shadow bg-white">
                    <CardContent className={isMobile ? "p-2" : "p-2"}>
                      <div className="relative aspect-square mb-2 rounded-md overflow-hidden bg-gray-100">
                        <img src={product.imagen_principal} alt={product.nombre} className="w-full h-full object-cover" loading="lazy" />
                        {product.stock_fisico === 0 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">Agotado</span>
                          </div>}
                      </div>
                      <div className="space-y-1">
                        {!isMobile && (
                          <h4 className="text-xs font-medium text-gray-900 line-clamp-2 h-8">
                            {product.nombre}
                          </h4>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold text-orange-600">
                            ${product.precio_b2b.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            /ud
                          </span>
                        </div>
                        <Badge style={{ backgroundColor: '#071d7f' }} className="text-[10px] px-1 h-4 text-white">
                          MOQ: {product.moq}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>)}
            </div>
          </div>
        </div>
      </div>
    </div>;
};

export default FeaturedProductsCarousel;