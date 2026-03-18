import { MouseEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, MessageCircle, ShieldCheck, TrendingUp, ArrowUpRight, Truck, Clock, Heart } from 'lucide-react';
import { ProductB2BCard, CartItemB2B } from '@/types/b2b';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useVariantDrawerStore from '@/stores/useVariantDrawerStore';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';
import { SuggestedPricesDetailModal } from '@/components/seller/SuggestedPricesDetailModal';
import { useBusinessPanelData } from '@/hooks/useBusinessPanelData';
import { useB2BFavorites } from '@/hooks/useB2BFavorites';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';

interface ProductCardB2BProps {
  product: ProductB2BCard;
  onAddToCart: (item: CartItemB2B) => void;
  cartItem?: CartItemB2B;
  whatsappNumber?: string;
}

const ProductCardB2B = ({ product, onAddToCart, cartItem, whatsappNumber = "50312345678" }: ProductCardB2BProps) => {
  const { role } = useAuth();
  const isAdmin = role === UserRole.ADMIN;
  const [showPricingModal, setShowPricingModal] = useState(false);
  const { toggle: toggleFav, isInFavorites } = useB2BFavorites();
  const isFav = isInFavorites(product.id);

  // Translate product name
  const { translated: translatedProduct } = useTranslatedContent(
    'product',
    product.id,
    { name: product.nombre, descripcion_corta: product.descripcion_corta || '' }
  );
  const displayName = translatedProduct.name || product.nombre;

  // Datos desde v_business_panel_data (se cargan solo cuando se abre el modal)
  const { data: bpData, isLoading: bpLoading } = useBusinessPanelData(
    showPricingModal ? product.id : undefined
  );

  const isOutOfStock = product.stock_fisico === 0;
  const hasMultipleVariants = (product.variant_count || 1) > 1;
  const hasPriceRange = product.precio_b2b_max && product.precio_b2b_max !== product.precio_b2b;

  // ============================================
  // CÁLCULO DE GANANCIA Y ROI
  // ============================================
  // Estos valores vienen de v_productos_con_precio_b2b (vista SQL)
  // profit_amount = precio_sugerido - precio_b2b
  // roi_percent = (profit / precio_b2b) * 100
  // 
  // precio_sugerido viene de:
  // 1. b2c_market_prices.max_price (si is_market_synced = true)
  // 2. pricing_configs.suggested_pvp (configurado por admin)
  // 3. Cálculo automático: precio_b2b * (1 + margen/100)
  // ============================================
  const profit = product.profit_amount ?? ((product.precio_sugerido || 0) - product.precio_b2b);
  const roiPercent = product.roi_percent ?? (product.precio_b2b > 0 ? (profit / product.precio_b2b) * 100 : 0);
  const isMarketSynced = product.is_market_synced ?? false;
  const pvpSource = product.pvp_source ?? 'calculated';
  
  // Calculate actual margin percentage for tooltip
  const actualMarginPercent = product.precio_b2b > 0 
    ? Math.round(((product.precio_sugerido - product.precio_b2b) / product.precio_b2b) * 100)
    : 0;

  // Weight validation
  const missingWeight = !product.weight_kg || product.weight_kg <= 0;

  // Logistics info
  const hasLogistics = !!product.logistics || (product.logistics_cost !== undefined && product.logistics_cost > 0);
  const logisticsCost = product.logistics_cost ?? product.logistics?.logisticsCost ?? 0;
  const estimatedDays = product.estimated_delivery_days ?? product.logistics?.estimatedDays ?? { min: 0, max: 0 };
  const hasDeliveryEstimate = estimatedDays.min > 0 || estimatedDays.max > 0;

  const handleWhatsApp = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = `Hola, estoy interesado en el siguiente producto:\n\n*${product.nombre}*\nSKU: ${product.sku}\nPrecio: $${product.precio_b2b.toFixed(2)}\n\nLink/Imagen: ${product.imagen_principal}`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Format price range
  const formatPriceRange = () => {
    if (hasPriceRange) {
      return `$${product.precio_b2b.toFixed(2)} - $${product.precio_b2b_max!.toFixed(2)}`;
    }
    return `$${product.precio_b2b.toFixed(2)}`;
  };

  // Format delivery time
  const formatDeliveryTime = () => {
    if (estimatedDays.min === estimatedDays.max) {
      return `${estimatedDays.min} días`;
    }
    return `${estimatedDays.min}-${estimatedDays.max} días`;
  };

  return (
    <div className={`group bg-white rounded-lg border hover:shadow-lg transition-all duration-300 flex flex-col h-full overflow-hidden ${
      cartItem ? 'border-primary ring-1 ring-primary' : 'border-border'
    }`}>
      {/* Image Section */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        <Link to={`/producto/${product.sku}`} className="block w-full h-full">
          <img
            src={product.imagen_principal}
            alt={product.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
        </Link>
        
        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {/* Profit Badge */}
          {profit > 0 && (
            <Badge className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +${profit.toFixed(2)}
            </Badge>
          )}
          
          {/* In Cart Badge */}
          {cartItem && (
            <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5">
              En carrito
            </Badge>
          )}
        </div>

        {/* Stock Badge - Top Right */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <div className="flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground bg-white/90 px-1.5 py-0.5 rounded">
            <ShieldCheck className="w-3 h-3 text-orange-500" />
            Verified
          </div>
        </div>

        {/* Bottom-right buttons: Heart + Pricing */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className={`h-9 w-9 p-0 rounded-full border-0 shadow-lg transition-colors ${
              isFav
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white/90 hover:bg-white text-gray-500 hover:text-red-500'
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFav(product.id);
            }}
            title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 rounded-full bg-blue-600 hover:bg-blue-700 border-0 text-white shadow-lg transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPricingModal(true);
            }}
            title="Ver desglose de precios"
          >
            <TrendingUp className="w-4 h-4" />
          </Button>
        </div>

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="destructive" className="text-xs font-bold">Agotado</Badge>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-3 flex flex-col flex-1">
        {/* Title */}
        <Link to={`/producto/${product.sku}`}>
          <h3 className="text-sm text-foreground line-clamp-1 mb-2 leading-snug hover:text-primary transition-colors font-medium" title={product.nombre}>
            {product.nombre}
          </h3>
        </Link>

        {/* Price Section */}
        <div className="mt-1 space-y-0.5">
          {/* B2B Price - Single Line */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-0.5 bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 rounded-md">
              <span className="text-destructive font-bold text-xs">
                {formatPriceRange()}
              </span>
              <span className="text-[8px] font-medium text-destructive">USD</span>
            </span>
          </div>
          
          {/* Rating & PVP - Same Line */}
          <div className="flex items-center gap-2 justify-between">
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-yellow-500">
              <span>★</span>
              {(product.rating || 0).toFixed(1)}
              {product.review_count && (
                <span className="text-[10px] text-muted-foreground">
                  ({product.review_count})
                </span>
              )}
            </span>
            
            {product.precio_sugerido > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-semibold cursor-help">
                      {isMarketSynced && (
                        <ArrowUpRight className="w-3 h-3 text-green-500" />
                      )}
                      PVP: ${product.precio_sugerido.toFixed(2)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {isMarketSynced ? (
                      <span className="text-green-600">
                        ✓ Precio máximo del mercado B2C ({product.num_b2c_sellers || 0} vendedores)
                      </span>
                    ) : pvpSource === 'admin' ? (
                      <span>Precio sugerido por administrador</span>
                    ) : (
                      <span>Precio calculado (+{actualMarginPercent}% margen)</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Profit & ROI indicator */}
          {profit > 0 && (
            <div className="flex items-center justify-between mt-1 px-1.5 py-0.5 bg-green-50 rounded text-[10px]">
              <span className="text-green-700 font-medium">
                Ganancia: +${profit.toFixed(2)}
              </span>
              <span className="text-green-600 font-bold">
                ROI {roiPercent.toFixed(0)}%
              </span>
            </div>
          )}

          {/* Logistics & Delivery Info */}
          {(hasLogistics || hasDeliveryEstimate) && (
            <div className="mt-1.5">
              {/* Shipping cost + Delivery time on same line */}
              <div className="flex items-center justify-between text-[10px]">
                {/* Shipping cost */}
                {logisticsCost > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-blue-600 cursor-help">
                          <Truck className="w-3 h-3" />
                          <span>+${logisticsCost.toFixed(2)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                        <div className="space-y-1">
                          <p className="font-medium">Costo de logística incluido</p>
                          {product.logistics?.routeName && (
                            <p className="text-muted-foreground">{product.logistics.routeName}</p>
                          )}
                          {product.category_fees && product.category_fees > 0 && (
                            <p className="text-muted-foreground">+ Tarifa categoría: ${product.category_fees.toFixed(2)}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Delivery time estimate */}
                {hasDeliveryEstimate && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-amber-600 cursor-help">
                          <Clock className="w-3 h-3" />
                          <span>{formatDeliveryTime()}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>Tiempo estimado de entrega desde origen</p>
                        {product.logistics?.originCountry && product.logistics?.destinationCountry && (
                          <p className="text-muted-foreground">
                            {product.logistics.originCountry} → {product.logistics.destinationCountry}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Actions Row */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
          {/* WhatsApp Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-600 transition-colors"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          
          {/* Add to Cart Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    size="sm"
                    className="h-8 w-full text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:pointer-events-none"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      useVariantDrawerStore.getState().open({
                        id: product.id,
                        sku: product.sku,
                        nombre: product.nombre,
                        images: product.imagen_principal ? [product.imagen_principal] : [],
                        price: product.precio_b2b,
                        costB2B: product.precio_b2b,
                        moq: product.moq,
                        stock: product.stock_fisico,
                        source_product_id: product.id,
                      });
                    }}
                    disabled={isOutOfStock || missingWeight}
                  >
                    <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                    {missingWeight ? 'Sin Peso' : 'B2B'}
                  </Button>
                </span>
              </TooltipTrigger>
              {missingWeight && (
                <TooltipContent side="top" className="max-w-[200px] text-center">
                  <p className="text-xs">⚠️ Peso no configurado — el admin debe agregar el peso del producto antes de poder comprarlo.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Pricing Detail Modal — datos desde v_business_panel_data */}
      <SuggestedPricesDetailModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        isLoading={bpLoading}
        items={
          bpData && bpData.shipping_cost_per_unit != null
            ? [
                {
                  productId: product.id,
                  variantId: undefined,
                  itemName: bpData.item_name,
                  quantity: 1,
                  costPerUnit: bpData.cost_per_unit,
                  shippingCostPerUnit: bpData.shipping_cost_per_unit,
                  suggestedPvpPerUnit: bpData.suggested_pvp_per_unit ?? bpData.cost_per_unit + bpData.shipping_cost_per_unit,
                  profitPerUnit: bpData.profit_1unit ?? bpData.shipping_cost_per_unit,
                  marginPercentage: bpData.margin_percentage ?? 0,
                  weight_kg: bpData.weight_kg,
                },
              ]
            : []
        }
      />
    </div>
  );
};

export default ProductCardB2B;
