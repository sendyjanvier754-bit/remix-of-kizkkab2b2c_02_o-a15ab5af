import { useState, useMemo, useEffect, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { BusinessPanel } from "@/components/business/BusinessPanel";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Trash2, Package, AlertCircle, MessageCircle, X, Banknote, Wallet, DollarSign, AlertTriangle, Info, CheckSquare, Square, TrendingUp, Loader2, ShoppingBag, Truck, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useB2BCartItems } from "@/hooks/useB2BCartItems";
import { useB2BCartProductTotals } from "@/hooks/useB2BCartProductTotals";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useCartSelectionStore } from "@/stores/useCartSelectionStore";
import { Checkbox } from "@/components/ui/checkbox";
import useVariantDrawerStore from "@/stores/useVariantDrawerStore";
import VariantDrawer from "@/components/products/VariantDrawer";
import VariantSelectorB2B from "@/components/products/VariantSelectorB2B";
import { useProductVariants } from "@/hooks/useProductVariants";
import { VariantBadges } from "@/components/seller/cart/VariantBadges";
import { addItemB2B } from "@/services/cartService";
import { useB2BCartLogistics } from "@/hooks/useB2BCartLogistics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBusinessPanelDataBatch } from "@/hooks/useBusinessPanelData";

const SellerCartPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, isLoading, refetch } = useB2BCartItems();
  const { productsNotMeetingMOQ, isCartValid, productTotals } = useB2BCartProductTotals();
  const isMobile = useIsMobile();
  
  // Get BusinessPanel data for all items in cart
  const itemsForBatch = useMemo(() => 
    items.map(item => ({
      productId: item.productId,
      variantId: item.variantId || undefined
    })),
    [items]
  );
  const { dataMap: businessPanelDataMap } = useBusinessPanelDataBatch(itemsForBatch);
  
  // Calculate logistics for all cart items
  const cartLogistics = useB2BCartLogistics(items);
  const [showClearCartDialog, setShowClearCartDialog] = useState(false);
  const [showRemoveItemDialog, setShowRemoveItemDialog] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<any>(null);
  const [variantSelections, setVariantSelections] = useState<any[]>([]);
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [variantImage, setVariantImage] = useState<string | null>(null);

  // Prefill variant quantities in the selector with what's already in the cart
  const initialVariantQuantities = useMemo(() => {
    if (!selectedProductForVariants?.id) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    items
      .filter((it) => it.productId === selectedProductForVariants.id && it.variantId)
      .forEach((it) => {
        const key = it.variantId as string;
        map[key] = (map[key] || 0) + (it.cantidad || 0);
      });
    return map;
  }, [items, selectedProductForVariants?.id]);

  // Fetch variants for the selected product
  const { data: productVariants, isLoading: isLoadingVariants } = useProductVariants(
    selectedProductForVariants?.id
  );

  // Cart selection store
  const { 
    b2bSelectedIds, 
    toggleB2BItem, 
    selectAllB2B, 
    deselectAllB2B, 
    isB2BItemSelected 
  } = useCartSelectionStore();

  // Auto-select all items when cart loads for the first time
  useEffect(() => {
    if (items.length > 0 && b2bSelectedIds.size === 0) {
      selectAllB2B(items.map(i => i.id));
    }
  }, [items, b2bSelectedIds.size, selectAllB2B]);

  // Calculate totals based on selected items
  const selectedItems = useMemo(() => 
    items.filter(item => b2bSelectedIds.has(item.id)), 
    [items, b2bSelectedIds]
  );
  const subtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.cantidad, 0);
  const allSelected = items.length > 0 && items.every(item => b2bSelectedIds.has(item.id));
  const someSelected = selectedItems.length > 0;

  // Calculate profit analysis for SELECTED items only using BusinessPanel view data
  const profitAnalysis = useMemo(() => {
    let totalInversion = 0; // Total cost (precio B2B * cantidad)
    let totalVenta = 0;      // Total retail (precio de venta * cantidad)
    let ganancia = 0;        // Profit (totalVenta - totalInversion)
    let margen = 0;          // Profit margin percentage

    selectedItems.forEach(item => {
      const costoItem = item.precioB2B * item.cantidad;
      
      // Get suggested PVP from BusinessPanel view
      const key = item.variantId 
        ? `${item.productId}-${item.variantId}`
        : item.productId;
      const businessPanelData = businessPanelDataMap.get(key);
      const suggestedPVP = businessPanelData?.suggested_pvp_per_unit || (item.precioB2B * 2.5);
      
      const ventaItem = suggestedPVP * item.cantidad;
      
      totalInversion += costoItem;
      totalVenta += ventaItem;
    });

    ganancia = totalVenta - totalInversion;
    margen = totalInversion > 0 ? (ganancia / totalInversion) * 100 : 0;

    return {
      inversion: totalInversion,
      venta: totalVenta,
      ganancia: ganancia,
      margen: margen
    };
  }, [selectedItems, businessPanelDataMap]);

  // Get unique payment methods - Default to Tarjetas, Transferencia, MonCash, NatCash
  const paymentMethods = useMemo(() => {
    return ['Tarjetas', 'Transferencia', 'MonCash', 'NatCash'];
  }, []);

  // Map payment method names to display info
  const getPaymentMethodDisplay = (method: string) => {
    const methodMap: Record<string, { label: string; color: string; icon?: string }> = {
      'tarjetas': { label: 'Tarjetas', color: '#1435CB', icon: 'card' },
      'transferencia': { label: 'Transferencia', color: '#071d7f', icon: 'bank' },
      'moncash': { label: 'MonCash', color: '#94111f', icon: 'wallet' },
      'natcash': { label: 'NatCash', color: '#1e40af', icon: 'wallet' },
    };

    const lowerMethod = method.toLowerCase();
    return methodMap[lowerMethod] || { label: method, color: '#6B7280', icon: 'wallet' };
  };

  // Remove item from cart after confirmation
  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('b2b_cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      toast.success('Producto eliminado del carrito');
      setShowRemoveItemDialog(false);
      setItemToRemove(null);
      refetch();
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('No se pudo eliminar el producto');
    }
  };

  // Update item quantity
  const updateQuantity = async (itemId: string, newQty: number) => {
    if (newQty < 1) {
      await removeItem(itemId);
      return;
    }

    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const newSubtotal = item.precioB2B * newQty;

      const { error } = await supabase
        .from('b2b_cart_items')
        .update({
          quantity: newQty,
          total_price: newSubtotal
        })
        .eq('id', itemId);

      if (error) throw error;
      toast.success('Cantidad actualizada');
      refetch();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('No se pudo actualizar la cantidad');
    }
  };

  // Show confirmation dialog for removing item
  const handleRemoveItem = (itemId: string, itemName: string) => {
    setItemToRemove({ id: itemId, name: itemName });
    setShowRemoveItemDialog(true);
  };

  // Show confirmation dialog for clearing cart
  const handleClearCart = () => {
    setShowClearCartDialog(true);
  };

  // Clear entire cart after confirmation
  const clearCart = async () => {
    try {
      if (!user?.id) {
        toast.error('Usuario no identificado');
        return;
      }

      // Get all cart IDs for this user
      const { data: carts } = await supabase
        .from('b2b_carts')
        .select('id')
        .eq('buyer_user_id', user.id)
        .eq('status', 'open');

      if (carts && carts.length > 0) {
        for (const cart of carts) {
          await supabase
            .from('b2b_cart_items')
            .delete()
            .eq('cart_id', cart.id);
        }
      }

      toast.success('Carrito vaciado');
      setShowClearCartDialog(false);
      refetch();
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('Error al vaciar carrito');
    }
  };

  const handleWhatsAppContact = async () => {
    try {
      // Get admin WhatsApp number from settings
      const { data: settingsData } = await supabase
        .from('price_settings')
        .select('value')
        .eq('key', 'admin_whatsapp')
        .maybeSingle();

      const adminWhatsApp = settingsData?.value?.toString() || '50937000000';
      const whatsappUrl = `https://wa.me/${adminWhatsApp}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      toast.error('Error al abrir WhatsApp');
    }
  };

  // Open variant drawer for a cart item
  const handleOpenVariantDrawer = async (item: any) => {
    try {
      console.log('Opening variant drawer for item:', item);

      // Try to find product by productId first, then by SKU/variant SKU
      let productId: string | undefined = item.productId || item.product_id || undefined;

      // 1) If cart SKU looks like a variant SKU, resolve product_id from v_variantes_con_precio_b2b
      if (!productId && item.sku) {
        try {
          const pvResult = await (supabase as any)
            .from('v_variantes_con_precio_b2b')
            .select('product_id, precio_b2b_final')
            .eq('sku', item.sku)
            .maybeSingle();

          if (pvResult?.data?.product_id) {
            productId = pvResult.data.product_id;
            console.log('✅ Resolved productId from variant SKU:', productId, 'precio_b2b:', pvResult.data.precio_b2b_final);
          }
        } catch (e) {
          console.log('Error searching v_variantes_con_precio_b2b by SKU:', e);
        }
      }

      // 2) Fallback: match base SKU against products.sku_interno
      if (!productId && item.sku) {
        // SKU format can be like "777795007250-Negro-39" or "777795007-Negro-39"
        const baseSku = item.sku.split('-')[0];
        console.log('No productId, searching product by base SKU:', baseSku);

        try {
          const result = await (supabase as any)
            .from('v_productos_con_precio_b2b')
            .select('id')
            .eq('sku_interno', baseSku)
            .maybeSingle();

          if (result?.data?.id) {
            productId = result.data.id;
            console.log('Found product by sku_interno:', productId);
          } else {
            const result2 = await (supabase as any)
              .from('v_productos_con_precio_b2b')
              .select('id')
              .ilike('sku_interno', `%${baseSku}%`)
              .limit(1)
              .maybeSingle();

            if (result2?.data?.id) {
              productId = result2.data.id;
              console.log('Found product by partial sku_interno match:', productId);
            }
          }
        } catch (e) {
          console.log('Error searching products by sku_interno:', e);
        }
      }

      if (!productId) {
        console.error('Could not find productId for item:', item);
        toast.error('No se pudo encontrar el producto. Intenta recargar la página.');
        return;
      }

      console.log('Found productId:', productId);

      // Fetch minimal product data for variant UI
      const productResult = await (supabase as any)
        .from('v_productos_con_precio_b2b')
        .select(
          'id, sku_interno, nombre, imagen_principal, precio_sugerido_venta, precio_b2b, descripcion_larga, descripcion_corta'
        )
        .eq('id', productId)
        .maybeSingle();

      if (productResult?.error) {
        console.error('Error fetching product:', productResult.error);
        toast.error('No se pudo cargar el producto');
        return;
      }

      const productData = productResult?.data;
      if (!productData || typeof productData !== 'object') {
        console.error('Product not found:', productId);
        toast.error('Producto no encontrado');
        return;
      }

      const description =
        (productData as any).descripcion_larga || (productData as any).descripcion_corta || '';

      const uiProduct = {
        id: (productData as any).id,
        sku: (productData as any).sku_interno,
        nombre: (productData as any).nombre,
        images: (productData as any).imagen_principal ? [(productData as any).imagen_principal] : [],
        price: (productData as any).precio_sugerido_venta || 0,
        costB2B: (productData as any).precio_b2b || 0, // ← Precio con márgenes
        description,
      };

      console.log('Loaded product:', uiProduct);

      // If mobile, open a modal with variant selection
      if (isMobile) {
        setSelectedProductForVariants(uiProduct);
      } else {
        // Desktop: use VariantDrawer
        useVariantDrawerStore.getState().open(uiProduct);
      }

      console.log('Variant drawer/modal opened successfully');
    } catch (err) {
      console.error('Error opening variant drawer:', err);
      toast.error('Error al abrir variantes');
    }
  };

  // Handle adding selected variants to cart
  const handleAddVariantsToCart = useCallback(async () => {
    if (!user?.id || !selectedProductForVariants || variantSelections.length === 0) {
      toast.error('Selecciona al menos una variante');
      return;
    }

    setIsAddingVariant(true);
    try {
      // Build current cart map for this product (by variantId)
      const existingByVariantId = new Map<
        string,
        { ids: string[]; qtyTotal: number; unitPrice: number }
      >();

      items
        .filter((it) => it.productId === selectedProductForVariants.id && it.variantId)
        .forEach((it) => {
          const vid = it.variantId as string;
          const entry = existingByVariantId.get(vid) || {
            ids: [],
            qtyTotal: 0,
            unitPrice: it.precioB2B,
          };
          entry.ids.push(it.id);
          entry.qtyTotal += it.cantidad || 0;
          existingByVariantId.set(vid, entry);
        });

      // Apply desired quantities (sum/rest) per variant
      let addedCount = 0;
      for (const selection of variantSelections) {
        const desiredQty = Number(selection.quantity || 0);
        const variantId = selection.variantId as string | undefined;
        if (!variantId) continue;

        const matchedVariant = (productVariants || []).find(v => v.id === selection.variantId);
        const attrs = (matchedVariant?.attribute_combination || {}) as Record<string, any>;
        const color = (attrs.color ?? selection.colorLabel ?? null) as string | null;
        const size = (attrs.size ?? attrs.talla ?? null) as string | null;

        const existing = existingByVariantId.get(variantId);
        const existingQty = existing?.qtyTotal ?? 0;
        const sameQty = desiredQty === existingQty;
        const samePrice = existing ? Math.abs((existing.unitPrice || 0) - Number(selection.price || 0)) < 0.0001 : false;

        // If variant exists and desired is 0 -> remove
        if (existing && desiredQty <= 0) {
          const { error } = await supabase
            .from('b2b_cart_items')
            .delete()
            .in('id', existing.ids);
          if (error) console.error('Error removing variant from cart:', error);
          continue;
        }

        // If variant exists and qty/price changed -> update to desired
        if (existing && ( !sameQty || !samePrice )) {
          const primaryId = existing.ids[0];
          const unitPrice = Number(selection.price || 0);

          const { error } = await supabase
            .from('b2b_cart_items')
            .update({
              sku: selection.sku,
              nombre: `${selectedProductForVariants.nombre} - ${selection.label}`,
              unit_price: unitPrice,
              quantity: desiredQty,
              total_price: unitPrice * desiredQty,
              image: variantImage || selectedProductForVariants.images?.[0] || null,
              variant_id: variantId,
              variant_attributes: attrs,
              color,
              size,
            })
            .eq('id', primaryId);

          if (error) {
            console.error('Error updating variant quantity:', error);
          } else {
            // Cleanup duplicates (if any)
            const duplicateIds = existing.ids.slice(1);
            if (duplicateIds.length > 0) {
              const { error: deleteError } = await supabase
                .from('b2b_cart_items')
                .delete()
                .in('id', duplicateIds);
              if (deleteError) console.warn('Could not delete duplicate cart items:', deleteError);
            }
          }
          continue;
        }

        // If variant doesn't exist and desired > 0 -> add
        if (!existing && desiredQty > 0) {
          try {
            await addItemB2B({
              userId: user.id,
              productId: selectedProductForVariants.id,
              sku: selection.sku,
              name: `${selectedProductForVariants.nombre} - ${selection.label}`,
              priceB2B: selection.price,
              quantity: desiredQty,
              image: variantImage || selectedProductForVariants.images?.[0] || null,
              variant: {
                variantId,
                color: color || undefined,
                size: size || undefined,
                variantAttributes: attrs,
              },
            });
            addedCount++;
          } catch (e) {
            console.error('Error adding/merging variant:', e);
          }
        }
      }

      if (addedCount > 0) {
        toast.success(`${addedCount} variante(s) agregada(s) al carrito`);
        setSelectedProductForVariants(null);
        setVariantSelections([]);
        setVariantImage(null);
        refetch();
      } else {
        // Even if no new variants were added, we may have updated or removed quantities
        toast.success('Carrito actualizado');
        setSelectedProductForVariants(null);
        setVariantSelections([]);
        setVariantImage(null);
        refetch();
      }
    } catch (error) {
      console.error('Error adding variants to cart:', error);
      toast.error('Error al agregar variantes');
    } finally {
      setIsAddingVariant(false);
    }
  }, [user?.id, selectedProductForVariants, variantSelections, variantImage, refetch, productVariants, items]);

  // Handle variant selection change from VariantSelectorB2B
  const handleVariantSelectionChange = useCallback((selections: any[], totalQty: number, totalPrice: number) => {
    setVariantSelections(selections);
  }, []);

  return (
    <SellerLayout>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Fixed Cart Section - Top (Only Mobile) */}
        {items.length > 0 && isMobile && (
          <div className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200">
            <div className="container mx-auto px-4 py-2">
              {/* Header */}
              <div 
                className="text-gray-900 p-1.5 rounded-lg flex items-center gap-1.5 bg-white border-b border-gray-200"
              >
                <ShoppingCart className="w-4 h-4" />
                <h1 className="font-bold text-sm">Carrito B2B</h1>
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">
                  {items.length}
                </span>
              </div>

              {/* Summary */}
              <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="flex gap-4">
                  <div>
                    <span className="text-gray-900">Total Items:</span>
                    <span className="font-bold ml-1 text-gray-900">{items.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-900">Unidades:</span>
                    <span className="font-bold ml-1 text-gray-900">{totalQuantity}</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-900">Total:</span>
                  <span className="font-bold ml-1 text-gray-900">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className={`flex-1 ${isMobile ? 'container mx-auto px-4 pb-40' : 'max-w-7xl mx-auto px-4 py-6'}`}>
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">Tu carrito está vacío</p>
              <p className="text-xs text-gray-500 mb-4">Visita el catálogo de lotes para abastecer tu inventario</p>
              <Button asChild style={{ backgroundColor: '#071d7f' }} className="text-white hover:opacity-90">
                <Link to="/seller/adquisicion-lotes">Ir al Catálogo</Link>
              </Button>
            </div>
          ) : !isMobile ? (
            // PC LAYOUT - Two columns inside a shared container
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mt-1">
              <div className="pt-6 px-6 pb-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* Left Column - Items (2/3) */}
                  <div className="lg:col-span-2 space-y-4">
                {/* MOQ Warning Banner */}
                {!isCartValid && productsNotMeetingMOQ.length > 0 && (
                  <Alert variant="destructive" className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <p className="font-semibold mb-2">Algunos productos no alcanzan el mínimo de pedido:</p>
                      <ul className="space-y-1 text-sm">
                        {productsNotMeetingMOQ.map(product => (
                          <li key={product.productId} className="flex items-center gap-2">
                            <span>• {product.productName}:</span>
                            <span className="font-medium">
                              {product.totalQuantity}/{product.moq} unidades
                            </span>
                            <span className="text-amber-600">
                              (faltan {product.missingQuantity})
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs mt-2 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Puedes combinar diferentes tallas y colores del mismo producto para alcanzar el mínimo.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={allSelected} 
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllB2B(items.map(i => i.id));
                            } else {
                              deselectAllB2B();
                            }
                          }}
                          className="data-[state=checked]:bg-[#071d7f] data-[state=checked]:border-[#071d7f]"
                        />
                        <h2 className="font-bold text-lg text-gray-900">Productos ({items.length})</h2>
                      </div>
                      <span className="text-sm text-gray-600">
                        {selectedItems.length} de {items.length} seleccionados
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 ml-7">Cantidad seleccionada: {totalQuantity}</p>
                  </div>

                  <div className="p-3 space-y-2">
                    {items.map((item) => {
                      const isSelected = b2bSelectedIds.has(item.id);
                      return (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-3 hover:shadow-md transition bg-white cursor-pointer ${
                          isSelected ? 'border-[#071d7f] bg-blue-50/30' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Checkbox */}
                          <div className="flex items-center">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleB2BItem(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="data-[state=checked]:bg-[#071d7f] data-[state=checked]:border-[#071d7f]"
                            />
                          </div>
                          {/* Product Image - Clickable Button */}
                          <button
                            onClick={() => handleOpenVariantDrawer(item)}
                            className="w-18 h-18 flex-shrink-0 rounded-md bg-muted overflow-hidden hover:opacity-80 transition border-none p-0"
                            style={{ width: '72px', height: '72px' }}
                            title="Ver variantes"
                          >
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground/50" />
                              </div>
                            )}
                          </button>
                          
                          {/* Product Details */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start">
                                <p className="font-medium text-sm text-gray-900 line-clamp-1 flex-1 min-w-0">
                                  {item.name}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveItem(item.id, item.name);
                                  }}
                                  className="text-gray-400 hover:text-red-600 transition ml-2 flex-shrink-0"
                                  title="Eliminar del carrito"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              {/* Variant badges + price on same row */}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {item.color && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                    {item.color}
                                  </span>
                                )}
                                {item.size && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    Talla: {item.size}
                                  </span>
                                )}
                                <span className="text-sm font-bold ml-2" style={{ color: '#29892a' }}>
                                  ${item.precioB2B.toFixed(2)}
                                </span>
                              </div>
                              
                              {/* Logistics info per item */}
                              {(() => {
                                const itemLogistics = cartLogistics.itemsLogistics.get(item.id);
                                if (!itemLogistics) return null;
                                return (
                                  <div className="flex items-center gap-3 mt-1 text-[10px]">
                                    <span className="text-blue-600 flex items-center gap-0.5">
                                      <Truck className="w-2.5 h-2.5" />
                                      +${itemLogistics.logisticsCost.toFixed(2)}
                                    </span>
                                    <span className="text-amber-600 flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      {itemLogistics.estimatedDays.min}-{itemLogistics.estimatedDays.max}d
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            {/* Quantity Controls + Subtotal */}
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(item.id, Math.max(1, item.cantidad - 1));
                                  }}
                                  className="p-0.5 hover:bg-gray-200 rounded text-xs font-medium transition"
                                >
                                  −
                                </button>
                                <span className="w-6 text-center text-xs font-medium">
                                  {item.cantidad}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(item.id, item.cantidad + 1);
                                  }}
                                  className="p-0.5 hover:bg-gray-200 rounded text-xs font-medium transition"
                                >
                                  +
                                </button>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm font-bold cursor-help" style={{ color: '#071d7f' }}>
                                      ${item.subtotal.toFixed(2)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">
                                    <div className="space-y-0.5">
                                      <p>Producto (sin envío): ${item.subtotal.toFixed(2)}</p>
                                      {cartLogistics.itemsLogistics.get(item.id) && (
                                        <p>Envío estimado aparte: +${(cartLogistics.itemsLogistics.get(item.id)!.logisticsCost * item.cantidad).toFixed(2)}</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>

                  {/* Right Column - Order Summary (1/3) */}
                  <div className="lg:col-span-1">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden sticky top-20">
                  {/* Summary Header */}
                  <div className="bg-gray-50 border-b border-gray-200 p-3">
                    <h2 className="font-bold text-base text-gray-900">Resumen del Pedido</h2>
                    <p className="text-xs text-gray-600 mt-1">Procesa descuentos y asientos luego confirmar precio final</p>
                  </div>

                  {/* Pricing Details */}
                  <div className="p-2 space-y-2 border-b border-gray-200">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Subtotal Productos:</span>
                      <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
                    </div>
                    
                    {/* Logistics Cost */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-between items-center text-xs cursor-help">
                            <span className="text-blue-600 flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              Logística Total:
                            </span>
                            <span className="font-semibold text-blue-600">
                              +${cartLogistics.totalLogisticsCost.toFixed(2)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs max-w-[200px]">
                          <p className="font-medium mb-1">Desglose de Logística</p>
                          <div className="space-y-0.5 text-muted-foreground">
                            <p>Envío total: ${cartLogistics.totalLogisticsCost.toFixed(2)}</p>
                            {cartLogistics.totalCategoryFees > 0 && (
                              <p>Tarifas categoría: ${cartLogistics.totalCategoryFees.toFixed(2)}</p>
                            )}
                            <p className="pt-1 border-t text-foreground">
                              {cartLogistics.routeName}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Delivery Time Estimate */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Tiempo de Entrega:
                      </span>
                      <span className="font-semibold text-amber-600">
                        {cartLogistics.estimatedDeliveryDays.min}-{cartLogistics.estimatedDeliveryDays.max} días
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Promociones:</span>
                      <span className="font-semibold text-red-600">—</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Cupón:</span>
                      <span className="font-semibold text-blue-600">—</span>
                    </div>
                  </div>

                  {/* Total Price */}
                  <div className="p-2 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Total Estimado:</span>
                      <span className="text-lg font-bold" style={{ color: '#071d7f' }}>
                        ${(subtotal + cartLogistics.totalLogisticsCost + cartLogistics.totalCategoryFees).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Incluye productos + envío a destino</p>
                  </div>

                  {/* Business Panel */}
                  {selectedItems.length > 0 && (
                    <div className="px-2 py-3 border-b border-gray-200">
                      <BusinessPanel
                        investment={profitAnalysis.inversion}
                        suggestedPricePerUnit={totalQuantity > 0 ? profitAnalysis.venta / totalQuantity : 0}
                        quantity={totalQuantity}
                        className="bg-blue-50 border-blue-200"
                      />
                    </div>
                  )}

                  {/* Payment Methods */}
                  <div className="p-2 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">Aceptamos:</p>
                    <div className="grid grid-cols-5 gap-1">
                      {/* Credit Cards Section - Show individual card types */}
                      {paymentMethods.includes('Tarjetas') && (
                        <>
                          {/* VISA */}
                          <div 
                            className="bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center hover:border-gray-300 transition"
                            title="VISA"
                          >
                            <img src="/visa.png" alt="VISA" className="h-4 w-auto" />
                          </div>

                          {/* MASTERCARD */}
                          <div 
                            className="bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center hover:border-gray-300 transition"
                            title="Mastercard"
                          >
                            <img src="/mastercard.png" alt="Mastercard" className="h-4 w-auto" />
                          </div>

                          {/* AMEX */}
                          <div 
                            className="bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center hover:border-gray-300 transition"
                            title="American Express"
                          >
                            <img src="/american express.png" alt="American Express" className="h-4 w-auto" />
                          </div>

                          {/* APPLE PAY */}
                          <div 
                            className="bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center hover:border-gray-300 transition"
                            title="Apple Pay"
                          >
                            <img src="/apple pay.png" alt="Apple Pay" className="h-4 w-auto" />
                          </div>

                          {/* GOOGLE PAY */}
                          <div 
                            className="bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center hover:border-gray-300 transition"
                            title="Google Pay"
                          >
                            <img src="/google pay.png" alt="Google Pay" className="h-4 w-auto" />
                          </div>
                        </>
                      )}

                      {/* Transferencia */}
                      {paymentMethods.includes('Transferencia') && (
                        <div 
                          className="bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center hover:border-gray-300 transition"
                          title="Transferencia Bancaria"
                        >
                          <Banknote className="h-4 w-4" style={{ color: '#071d7f' }} />
                        </div>
                      )}

                      {/* MonCash */}
                      {paymentMethods.includes('MonCash') && (
                        <div 
                          className="bg-white border border-gray-200 rounded p-2 flex flex-col items-center justify-center hover:border-gray-300 transition"
                          title="MonCash"
                        >
                          <Banknote className="h-5 w-5" style={{ color: '#94111f' }} />
                        </div>
                      )}

                      {/* NatCash */}
                      {paymentMethods.includes('NatCash') && (
                        <div 
                          className="bg-white border border-gray-200 rounded p-2 flex flex-col items-center justify-center hover:border-gray-300 transition"
                          title="NatCash"
                        >
                          <Banknote className="h-5 w-5" style={{ color: '#1e40af' }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checkout Button and Support */}
                  <div className="p-2 space-y-2">
                    {!isCartValid && (
                      <div className="text-xs text-amber-600 text-center bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        Alcanza los mínimos para continuar
                      </div>
                    )}
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleWhatsAppContact}
                        className="px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-2 bg-transparent border border-gray-300"
                        style={{ color: '#29892a' }}
                        title="Contactar por WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" style={{ color: '#29892a' }} />
                        WhatsApp
                      </button>
                      {isCartValid && someSelected ? (
                        <Link
                          to="/seller/checkout"
                          className="px-4 py-2 rounded-lg font-semibold text-xs text-white transition hover:opacity-90 flex items-center justify-center gap-2 shadow-lg"
                          style={{ backgroundColor: '#071d7f' }}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Comprar ({totalQuantity})
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="px-4 py-2 rounded-lg font-semibold text-xs text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                          style={{ backgroundColor: '#071d7f' }}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          {!someSelected ? 'Selecciona productos' : `Comprar (${totalQuantity})`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // MOBILE LAYOUT - Keep as original
            <>
              {/* Items */}
              {items.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Selection Header Mobile */}
                  <div className="p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={allSelected} 
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllB2B(items.map(i => i.id));
                          } else {
                            deselectAllB2B();
                          }
                        }}
                        className="data-[state=checked]:bg-[#071d7f] data-[state=checked]:border-[#071d7f]"
                      />
                      <span className="text-sm font-medium text-gray-700">Seleccionar todos</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {selectedItems.length}/{items.length}
                    </span>
                  </div>
                  <div className="p-1 space-y-0 bg-white" style={{ backgroundColor: '#d9d9d9' }}>
                    {items.map((item) => {
                      const isSelected = b2bSelectedIds.has(item.id);
                      return (
                      <div
                        key={item.id}
                        className={`border-b border-gray-200 last:border-b-0 p-1 hover:bg-gray-100 transition flex gap-2 ${
                          isSelected ? 'bg-blue-50' : 'bg-white'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="flex items-center pl-1">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleB2BItem(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="data-[state=checked]:bg-[#071d7f] data-[state=checked]:border-[#071d7f]"
                          />
                        </div>
                        {/* Product Image - Clickable Button */}
                        <button
                          onClick={() => handleOpenVariantDrawer(item)}
                          className="w-16 h-16 flex-shrink-0 rounded-lg bg-muted overflow-hidden hover:opacity-80 transition border-none p-0"
                          title="Ver variantes"
                        >
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                        </button>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-medium text-sm text-gray-900 line-clamp-1 flex-1 min-w-0">
                                {item.name}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveItem(item.id, item.name);
                                }}
                                className="text-gray-400 hover:text-red-600 transition ml-2 flex-shrink-0"
                                title="Eliminar del carrito"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Variant badges + price on same row */}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {item.color && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                  {item.color}
                                </span>
                              )}
                              {item.size && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  Talla: {item.size}
                                </span>
                              )}
                              <span className="text-sm font-bold ml-2" style={{ color: '#29892a' }}>
                                ${item.precioB2B.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {/* Quantity Controls + Subtotal */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(item.id, Math.max(1, item.cantidad - 1));
                                }}
                                className="p-0.5 hover:bg-gray-200 rounded text-xs font-medium transition"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-xs font-medium">
                                {item.cantidad}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(item.id, item.cantidad + 1);
                                }}
                                className="p-0.5 hover:bg-gray-200 rounded text-xs font-medium transition"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm font-bold" style={{ color: '#071d7f' }}>
                              ${item.subtotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Botones Fijos - Solo Mobile */}
        {items.length > 0 && isMobile && (
          <div className="fixed left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 bottom-10 z-40 flex flex-col gap-2">
            {/* MOQ Warning for Mobile */}
            {!isCartValid && (
              <div className="text-xs text-amber-600 text-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {productsNotMeetingMOQ.length} producto(s) no alcanzan el mínimo
              </div>
            )}
            <div className="rounded-lg p-1 border border-gray-300 shadow-md" style={{ backgroundColor: '#efefef' }}>
              <div className="flex gap-1 justify-between items-center">
                {/* Botón WhatsApp */}
                <button
                  onClick={handleWhatsAppContact}
                  className="p-2 rounded-lg font-semibold text-sm transition shadow-lg flex items-center justify-center"
                  style={{ color: 'white', backgroundColor: '#29892a' }}
                  title="Contactar por WhatsApp"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Total en el Medio - Clickeable */}
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="transition-all hover:opacity-80"
                >
                  <Badge variant="outline" className="text-sm border-2 px-3 py-1.5 rounded-lg" style={{ borderColor: '#29892a', color: '#29892a' }}>
                    <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                    ${subtotal.toFixed(2)}
                  </Badge>
                </button>

                {/* Botón Comprar B2B */}
                {isCartValid && someSelected ? (
                  <Link
                    to="/seller/checkout"
                    className="px-4 py-2 rounded-lg font-semibold text-sm transition shadow-lg hover:opacity-90 flex items-center justify-center gap-1.5 text-white"
                    style={{ backgroundColor: '#071d7f' }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Comprar B2B ({totalQuantity})
                  </Link>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 text-white opacity-50 cursor-not-allowed"
                    style={{ backgroundColor: '#071d7f' }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {!someSelected ? 'Selecciona' : `Comprar (${totalQuantity})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <AlertDialog open={showClearCartDialog} onOpenChange={setShowClearCartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vaciar carrito</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar todos los productos de tu carrito B2B? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearCart()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Vaciar carrito
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Item Confirmation Dialog */}
      <AlertDialog open={showRemoveItemDialog} onOpenChange={setShowRemoveItemDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToRemove && removeItem(itemToRemove.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Modal */}
      <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
        <DialogContent className="max-w-sm w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#071d7f]" />
                Resumen
              </DialogTitle>
              <span className="text-xs bg-[#071d7f]/10 text-[#071d7f] px-2 py-1 rounded-full font-semibold">
                {selectedItems.length} producto{selectedItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Items List - Miniaturas con scroll horizontal */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Artículos ({selectedItems.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-1 bg-gray-50 p-2 rounded-lg border border-gray-200 scrollbar-hide">
                {selectedItems.map((item) => {
                  return (
                  <button
                    key={item.id}
                    onClick={() => handleOpenVariantDrawer(item)}
                    className="flex-shrink-0 relative group cursor-pointer transition-transform hover:scale-105 border-none bg-transparent p-0"
                    title="Ver variantes"
                  >
                                    <div className="relative w-16 h-16 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center hover:border-[#071d7f]">
                                      {item.image ? (
                                        <img 
                                          src={item.image} 
                                          alt={item.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <Package className="w-6 h-6 text-gray-400" />
                                      )}
                                      {/* Variant badges overlay */}
                                      <VariantBadges
                                        color={item.color}
                                        size={item.size}
                                        variantAttributes={item.variantAttributes}
                                        maxChars={6}
                                        compact
                                        className="absolute bottom-0.5 left-0.5 right-0.5 flex gap-0.5 flex-wrap pointer-events-none"
                                      />
                                    </div>
                    {/* Cantidad badge */}
                    <div className="absolute -top-2 -right-2 bg-[#071d7f] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                      {item.cantidad}
                    </div>
                    {/* Tooltip en hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {item.name}
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="space-y-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex justify-between text-xs">
                <span className="text-gray-700">Total artículos:</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-700">Envío:</span>
                <span className="font-medium text-green-600">Gratis</span>
              </div>
              <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between">
                <span className="font-bold text-sm">Total</span>
                <span className="font-bold text-lg text-[#071d7f]">${subtotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 flex gap-2">
            <Button
              onClick={() => setShowSummaryModal(false)}
              variant="outline"
              className="flex-1"
            >
              Cerrar
            </Button>
            <Button
              asChild
              className="flex-1 text-white"
              style={{ backgroundColor: '#071d7f' }}
            >
              <Link to="/seller/checkout">
                Continuar
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Drawer */}
      <VariantDrawer />

      {/* Mobile Variant Selection Drawer */}
      {selectedProductForVariants && (
        <Drawer open={true} onOpenChange={(open) => {
          if (!open) {
            setSelectedProductForVariants(null);
            setVariantSelections([]);
            setVariantImage(null);
          }
        }}>
          <DrawerContent className="flex flex-col max-h-[90vh] p-0 gap-0">
            {/* Header - Fixed */}
            <DrawerHeader className="py-3 px-4 pb-2 border-b flex-shrink-0 bg-white">
              <DrawerTitle className="text-base line-clamp-1">{selectedProductForVariants.nombre}</DrawerTitle>
              <DrawerDescription className="text-xs">
                Selecciona variantes para agregar al carrito
              </DrawerDescription>
            </DrawerHeader>
            
            {/* Product Image - Fixed Above Box */}
            <div className="px-3 pt-2 pb-2 flex-shrink-0 bg-white">
              <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                <img 
                  src={variantImage || selectedProductForVariants.images?.[0] || '/placeholder.svg'} 
                  alt={selectedProductForVariants.nombre}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Main Content Box with Scroll */}
            <div className="flex-1 min-h-0 px-3 py-2 overflow-hidden">
              <div className="w-full h-full border border-gray-200 rounded-lg bg-white overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {/* Price Info */}
                    <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-sm">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Precio B2B</p>
                        <p className="font-bold" style={{ color: '#29892a' }}>
                          ${selectedProductForVariants.costB2B?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      {variantSelections.length > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Seleccionado</p>
                          <p className="font-bold text-primary text-sm">
                            {variantSelections.reduce((sum, s) => sum + s.quantity, 0)} uds
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Variant Selector */}
                    {isLoadingVariants ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="ml-2 text-xs text-muted-foreground">Cargando variantes...</span>
                      </div>
                    ) : productVariants && productVariants.length > 0 ? (
                      <VariantSelectorB2B
                        productId={selectedProductForVariants.id}
                        variants={productVariants.map(v => {
                          // Extract color and size from attribute_combination
                          const attrCombo = v.attribute_combination || {};
                          const colorVal = attrCombo.color || v.option_value || '';
                          const sizeVal = attrCombo.size || '';
                          const labelParts = [colorVal, sizeVal].filter(Boolean);
                          const label = v.name || labelParts.join(' / ') || v.sku;
                          
                          return {
                            id: v.id,
                            sku: v.sku,
                            label,
                            precio: v.cost_price || v.price || selectedProductForVariants.costB2B || 0,
                            stock: v.stock || 999,
                            attribute_combination: attrCombo,
                            images: v.images || [],
                            image_url: v.images?.[0] || undefined,
                          };
                        })}
                        basePrice={selectedProductForVariants.costB2B || 0}
                        baseImage={selectedProductForVariants.images?.[0]}
                        initialQuantities={initialVariantQuantities}
                        onSelectionChange={handleVariantSelectionChange}
                        onVariantImageChange={setVariantImage}
                      />
                    ) : (
                      <div className="text-center py-3 text-muted-foreground">
                        <Package className="h-6 w-6 mx-auto mb-1 opacity-50" />
                        <p className="text-xs">No hay variantes disponibles</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-2 border-t bg-background flex gap-2 flex-shrink-0">
              <Button
                onClick={() => {
                  setSelectedProductForVariants(null);
                  setVariantSelections([]);
                  setVariantImage(null);
                }}
                variant="outline"
                className="flex-1 h-9 text-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddVariantsToCart}
                disabled={isAddingVariant || variantSelections.length === 0}
                className="flex-1 h-9 text-sm text-white"
                style={{ backgroundColor: '#071d7f' }}
              >
                {isAddingVariant ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-3 w-3 mr-1" />
                    Agregar ({variantSelections.reduce((sum, s) => sum + s.quantity, 0)})
                  </>
                )}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </SellerLayout>
  );
};

export default SellerCartPage;
