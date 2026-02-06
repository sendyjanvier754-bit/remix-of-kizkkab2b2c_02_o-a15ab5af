import React, { useEffect, useState, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import VariantSelector from './VariantSelector';
import useVariantDrawerStore from '@/stores/useVariantDrawerStore';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';
import { addItemB2C, addItemB2B } from '@/services/cartService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { X, TrendingUp, ImageIcon, Info } from 'lucide-react';
import { useB2BCartProductTotals } from '@/hooks/useB2BCartProductTotals';
import { BusinessPanel } from '@/components/business/BusinessPanel';
import { useProductVariants } from '@/hooks/useProductVariants';

const VariantDrawer: React.FC = () => {
  const isMobile = useIsMobile();
  const { isOpen, product, close, onComplete } = useVariantDrawerStore();
  const [selections, setSelections] = useState<any[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [variantImage, setVariantImage] = useState<string | null>(null);
  const [basePriceFromDb, setBasePriceFromDb] = useState<number | null>(null);
  const [variantPrices, setVariantPrices] = useState<Record<string, number>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const { user, role } = useAuth();
  const { toast } = useToast();

  const isB2BUser = role === UserRole.SELLER || role === UserRole.ADMIN;
  
  // Get cart product totals for MOQ validation at product level
  const { getProductTotal } = useB2BCartProductTotals();
  
  // Fetch product variants to get attribute_combination for each variant
  // ✅ CRÍTICO: Pasar isB2BUser para que cargue desde v_variantes_con_precio_b2b cuando sea B2B
  const { data: productVariants } = useProductVariants(product?.source_product_id || product?.id, isB2BUser);

  // 1. Fetch base price from DB for B2B users
  useEffect(() => {
    const fetchPricesFromDb = async () => {
      if (!isB2BUser || !product?.source_product_id) return;
      
      const { data: productData } = await supabase
        .from('v_productos_con_precio_b2b')
        .select('precio_b2b')
        .eq('id', product.source_product_id)
        .single();
      
      if (productData) {
        setBasePriceFromDb(productData.precio_b2b);
      }
    };
    
    fetchPricesFromDb();
  }, [isB2BUser, product?.source_product_id]);

  // 2. Extract variant prices from productVariants
  useEffect(() => {
    if (!isB2BUser || !productVariants || productVariants.length === 0) {
      setVariantPrices({});
      return;
    }

    const priceMap = productVariants.reduce((acc: Record<string, number>, variant: any) => {
      if (variant.precio_b2b_final) {
        acc[variant.id] = variant.precio_b2b_final;
      }
      return acc;
    }, {});

    setVariantPrices(priceMap);
  }, [productVariants, isB2BUser]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelections([]);
      setTotalQty(0);
      setTotalPrice(0);
      setVariantImage(null);
      setSelectedVariantId(null);
    }
  }, [isOpen]);

  // Get the current display image (variant image or product image)
  const displayImage = variantImage || product?.images?.[0] || '/placeholder.svg';
  
  const displayPrice = isB2BUser 
    ? (basePriceFromDb !== null ? basePriceFromDb : (product?.costB2B || 0))
    : (product?.price || 0);

  // Business calculator for B2B users
  const businessSummary = useMemo(() => {
    if (!isB2BUser || !product || totalQty === 0 || totalPrice === 0) return null;
    
    // Investment = totalPrice (sum of variant prices from vista × quantities)
    const investment = totalPrice;
    
    // Calculate average cost per unit from selected variants
    const avgCostPerUnit = investment / totalQty;
    
    // PVP suggestion: Apply 2.5x markup on B2B cost for retail
    const suggestedPvpPerUnit = avgCostPerUnit * 2.5;
    
    return {
      investment,
      suggestedPvpPerUnit,
      quantity: totalQty
    };
  }, [isB2BUser, product, totalQty, totalPrice]);

  // Calculate product-level MOQ validation (cart + new selection)
  const productId = product?.source_product_id || product?.id || '';
  const productMoq = product?.moq || 1;
  const cartProductTotal = getProductTotal(productId);
  const currentCartQty = cartProductTotal?.totalQuantity || 0;
  const combinedTotal = currentCartQty + totalQty;
  const meetsMOQWithSelection = combinedTotal >= productMoq;
  const quantityStillNeeded = Math.max(0, productMoq - combinedTotal);

  const handleConfirm = async () => {
    if (!product) return;

    // Validate MOQ at product level (cart total + new selection)
    // Allow adding if combined total meets MOQ
    if (isB2BUser && !meetsMOQWithSelection && totalQty > 0) {
      toast({ 
        title: 'Cantidad mínima no alcanzada', 
        description: `Necesitas ${quantityStillNeeded} unidades más para alcanzar el mínimo de ${productMoq}. Puedes combinar diferentes tallas y colores.`, 
        variant: 'destructive' 
      });
      return;
    }

    if (!user?.id) {
      toast({ title: 'Error', description: 'Debes estar autenticado para agregar items', variant: 'destructive' });
      return;
    }

    // If there are selected variants, add each selection
    if (selections.length > 0 && totalQty > 0) {
      for (const sel of selections) {
        const qty = sel.quantity || 0;
        if (qty <= 0) continue;

        // Look up the variant from productVariants to get attribute_combination
        const matchedVariant = (productVariants || []).find(v => v.id === sel.variantId);
        const attrs = matchedVariant?.attribute_combination || {};
        const color = (attrs.color ?? null) as string | null;
        const size = (attrs.size ?? attrs.talla ?? null) as string | null;
        const variantLabel = matchedVariant ? `${color || ''}${color && size ? ' / ' : ''}${size || ''}`.trim() : '';
        const itemName = variantLabel ? `${product.nombre} - ${variantLabel}` : product.nombre;

        if (isB2BUser) {
          await addItemB2B({
            userId: user.id,
            productId: product.source_product_id || product.id,
            sku: matchedVariant?.sku || product.sku || product.id,
            name: itemName,
            priceB2B: matchedVariant?.price ?? product.costB2B ?? product.price ?? 0,
            quantity: qty,
            image: variantImage || matchedVariant?.images?.[0] || product.images?.[0] || undefined,
            variant: {
              variantId: sel.variantId,
              color,
              size,
              variantAttributes: attrs,
            },
          });
        } else {
          await addItemB2C({
            userId: user.id,
            sku: matchedVariant?.sku || product.sku || product.id,
            name: itemName,
            price: matchedVariant?.price ?? product.price ?? 0,
            quantity: qty,
            image: variantImage || matchedVariant?.images?.[0] || product.images?.[0] || undefined,
            variant: {
              variantId: sel.variantId,
              color,
              size,
              variantAttributes: attrs,
            },
          });
        }
      }
      toast({ title: isB2BUser ? 'Agregado al pedido B2B' : 'Agregado al carrito', description: `${product.nombre} (${totalQty} uds)` });
    } else if (totalQty > 0) {
      // No variant selections, fallback to single add
      if (isB2BUser) {
        await addItemB2B({
          userId: user.id,
          productId: product.source_product_id || product.id,
          sku: product.sku || product.id,
          name: product.nombre,
          priceB2B: product.costB2B ?? product.price ?? 0,
          quantity: totalQty,
          image: product.images?.[0] || undefined,
        });
        toast({ title: 'Agregado al pedido B2B', description: `${product.nombre} (${totalQty} uds)` });
      } else {
        await addItemB2C({
          userId: user.id,
          sku: product.sku || product.id,
          name: product.nombre,
          price: product.price || 0,
          quantity: totalQty,
          image: product.images?.[0] || undefined,
        });
        toast({ title: 'Agregado al carrito' });
      }
    }

    close();
    if (onComplete) onComplete();
  };

  if (!isOpen || !product) return null;

  const pvpPrice = product.pvp || product.price || 0;

  // Mobile: Bottom Sheet | Desktop: Side Drawer
  return (
    <div 
      className={`fixed z-[60] flex ${isMobile ? 'inset-0 items-end' : 'top-[160px] right-0 bottom-0 left-0 justify-end items-stretch'}`}
      style={{ pointerEvents: 'auto' }}
    >
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        onClick={() => close()} 
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      />
      
      {/* Drawer Panel - Mobile: Bottom Sheet | Desktop: Side Drawer */}
      <aside
        className={`
          relative bg-background shadow-2xl flex flex-col
          ${isMobile 
            ? 'w-full max-h-[85vh] rounded-t-2xl border-t' 
            : 'border-l'
          }
        `}
        style={isMobile ? { 
          animation: 'slideInUp 0.3s ease-out'
        } : { 
          width: '332px', 
          height: 'calc(100vh - 160px)',
          maxHeight: 'calc(100vh - 160px)',
          animation: 'slideInRight 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-foreground">Seleccionar variantes</h3>
          <button onClick={() => close()} className="p-1 hover:bg-muted rounded-full transition">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Product Info with Dynamic Image */}
          <div className="flex gap-3 pb-3 border-b">
            <div className="relative w-20 h-20 flex-shrink-0">
              <img 
                src={displayImage} 
                alt={product.nombre} 
                className="w-full h-full object-cover rounded-lg border border-border transition-all duration-300"
              />
              {variantImage && variantImage !== product?.images?.[0] && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <ImageIcon className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground line-clamp-2">{product.nombre}</h4>
              {isB2BUser ? (
                selectedVariantId && variantPrices[selectedVariantId] ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">${variantPrices[selectedVariantId].toFixed(2)}</span>
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">B2B</span>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-muted-foreground italic">
                    Selecciona una variante para ver el precio
                  </div>
                )
              ) : (
                <div className="mt-1 text-lg font-bold text-foreground">${displayPrice.toFixed(2)}</div>
              )}
              <span className="text-[10px] text-muted-foreground">costo</span>
            </div>
          </div>

          {/* Variant Selector with Image Change Callback */}
          <VariantSelector 
            productId={product.source_product_id || product.id} 
            basePrice={displayPrice}
            baseImage={product.images?.[0]}
            isB2B={isB2BUser}
            variantPrices={variantPrices}
            onSelectionChange={(list, qty, price) => {
              setSelections(list);
              setTotalQty(qty);
              setTotalPrice(price);
              // Track the first selected variant for price display
              const firstSelected = list.find((s: any) => s.quantity > 0);
              setSelectedVariantId(firstSelected ? firstSelected.variantId : null);
            }}
            onVariantImageChange={(img) => setVariantImage(img)}
          />

          {/* B2B Business Panel */}
          {isB2BUser && businessSummary && (
            <BusinessPanel
              investment={businessSummary.investment}
              suggestedPricePerUnit={businessSummary.suggestedPvpPerUnit}
              quantity={businessSummary.quantity}
            />
          )}
        </div>

        {/* Footer - sticky */}
        <div className="p-4 border-t bg-background">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <span className="text-sm font-medium">-</span>
              </Button>
              <span className="w-8 text-center font-semibold">{totalQty}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <span className="text-sm font-medium">+</span>
              </Button>
            </div>
            <div className="text-center px-4 py-1 bg-muted rounded-full">
              <span className="text-sm font-bold">${totalPrice.toFixed(2)}</span>
            </div>
            <Button 
              onClick={handleConfirm} 
              className="h-10 px-4"
              disabled={totalQty === 0}
            >
              🛒 Comprar
            </Button>
          </div>
          {/* Flexible MOQ messaging for B2B */}
          {isB2BUser && productMoq > 1 && (
            <div className="space-y-1.5">
              {/* Show current cart total if exists */}
              {currentCartQty > 0 && (
                <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded-md py-1">
                  Ya tienes <span className="font-semibold text-foreground">{currentCartQty}</span> unidades en el carrito
                </div>
              )}
              
              {/* Show MOQ status */}
              {meetsMOQWithSelection ? (
                <div className="text-xs text-center text-green-600 flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  ✓ Mínimo de {productMoq} unidades alcanzado
                </div>
              ) : (
                <div className="text-xs text-center text-amber-600 flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  Te faltan {quantityStillNeeded} unidades (Min: {productMoq})
                </div>
              )}
              
              {/* Combine variants message */}
              <div className="text-[10px] text-center text-muted-foreground">
                💡 Puedes combinar tallas y colores para llegar al mínimo
              </div>
            </div>
          )}
        </div>
      </aside>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideInUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default VariantDrawer;