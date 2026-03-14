import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { BusinessPanel } from "@/components/business/BusinessPanel";
import { ShippingTypeSelector } from "@/components/seller/ShippingTypeSelector";
import CartModeTabs from "@/components/cart/CartModeTabs";
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

import { ShoppingCart, Trash2, Package, AlertCircle, MessageCircle, X, Banknote, Wallet, DollarSign, AlertTriangle, Info, CheckSquare, Square, TrendingUp, Loader2, ShoppingBag, Truck, Clock, Share2, Copy, Check } from "lucide-react";
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
import { QuantitySelector } from "@/components/ui/quantity-selector";
import VariantSelectorB2B from "@/components/products/VariantSelectorB2B";
import { useProductVariants } from "@/hooks/useProductVariants";
import { VariantBadges } from "@/components/seller/cart/VariantBadges";
import { addItemB2B } from "@/services/cartService";
import { useB2BCartLogistics } from "@/hooks/useB2BCartLogistics";
import { useStoreByOwner } from "@/hooks/useStore";
import { useMarkets } from "@/hooks/useMarkets";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBusinessPanelDataBatch } from "@/hooks/useBusinessPanelData";
import { SuggestedPricesDetailModal } from "@/components/seller/SuggestedPricesDetailModal";
import { useLogisticsDataForItems } from "@/hooks/useLogisticsDataForItems";
import { useCartShippingCostView } from "@/hooks/useCartShippingCostView";
import { useAutoSaveCartWithShipping } from "@/hooks/useAutoSaveCartWithShipping";
import { useQueryClient } from "@tanstack/react-query";

const SellerCartPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { items: itemsFromDB, isLoading, refetch } = useB2BCartItems();

  // Estado local para updates optimistas — debe declararse ANTES de useB2BCartProductTotals
  // para que la validación MOQ sea inmediata al cambiar cantidades.
  const [items, setItems] = useState(itemsFromDB);
  const pendingUpdatesRef = useRef(new Set<string>());
  const lastUpdateTimeRef = useRef<number>(0);

  // Sincronizar con items de la DB solo si no hay updates pendientes RECIENTES
  useEffect(() => {
    const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;

    // Si hay updates pendientes O si fue hace menos de 2 segundos, no sincronizar
    if (pendingUpdatesRef.current.size > 0 || timeSinceLastUpdate < 2000) {
      return;
    }

    // Sincronizar solo si no hay cambios pendientes
    setItems(itemsFromDB);
  }, [itemsFromDB]);

  // Pasar items optimistas para que isCartValid / productsNotMeetingMOQ
  // se actualicen en tiempo real sin recargar la página.
  const { productsNotMeetingMOQ, isCartValid, productTotals } = useB2BCartProductTotals(items);
  const isMobile = useIsMobile();

  // Resolve seller's market → destination country for shipping tier filtering
  const { data: store } = useStoreByOwner(user?.id);
  const { readyMarkets } = useMarkets();
  const cartCountryId = useMemo(() => {
    if (!store?.market_id || !readyMarkets.length) return undefined;
    return readyMarkets.find(m => m.id === store.market_id)?.destination_country_id ?? undefined;
  }, [store?.market_id, readyMarkets]);
  
  // Shipping state - DEBE IR ANTES de usar selectedShippingTypeId
  const [selectedShippingTypeId, setSelectedShippingTypeId] = useState<string | null>(null);
  const [shippingSummary, setShippingSummary] = useState<any>(null);
  const defaultRouteId = '21420dcb-9d8a-4947-8530-aaf3519c9047'; // China → Haití
  const [includeShippingInTotal, setIncludeShippingInTotal] = useState(false);
  
  // Get BusinessPanel data for all items in cart
  const itemsForBatch = useMemo(() => 
    items.map(item => ({
      productId: item.productId,
      variantId: item.variantId || undefined
    })),
    [items]
  );
  const { dataMap: businessPanelDataMap } = useBusinessPanelDataBatch(itemsForBatch);
  
  // Get cart logistics info (routes, ETA, category fees, etc.)
  // ✅ Pasar selectedShippingTypeId para calcular costo con el tier correcto
  const cartLogistics = useB2BCartLogistics(items, selectedShippingTypeId);
  
  // Fetch shipping costs from unified v_logistics_data view
  const { result: shippingCosts } = useLogisticsDataForItems(itemsForBatch);
  
  const [showClearCartDialog, setShowClearCartDialog] = useState(false);
  const [showSuggestedPricesModal, setShowSuggestedPricesModal] = useState(false);
  const [showRemoveItemDialog, setShowRemoveItemDialog] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);
  const [showOrderSummaryDrawer, setShowOrderSummaryDrawer] = useState(false);

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
    selectedProductForVariants?.id,
    true // ✅ isB2B = true para obtener precios B2B desde vista v_variantes_con_precio_b2b
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

  // Calculate totals based on selected items (BEFORE hooks that need it)
  const selectedItems = useMemo(() => 
    items.filter(item => b2bSelectedIds.has(item.id)), 
    [items, b2bSelectedIds]
  );

  // ✅ NUEVO: Auto-save cart con shipping calculation 100% desde DB
  const {
    shippingCost: autoSaveShippingCost,
    isSaving: isAutoSaving,
    isCalculatingShipping: isCalculatingAutoShipping,
    updateQuantity: autoSaveUpdateQuantity,
    // TICKET #18: tier guardado en DB para restaurar al recargar
    savedShippingTypeId,
  } = useAutoSaveCartWithShipping(selectedShippingTypeId, refetch);

  // TICKET #18: restaurar el tier guardado cuando llega del hook (solo una vez, si el user no eligió uno ya)
  useEffect(() => {
    if (savedShippingTypeId && !selectedShippingTypeId) {
      setSelectedShippingTypeId(savedShippingTypeId);
    }
  }, [savedShippingTypeId]);

  // ⚠️ DEPRECADO: Hook antiguo (mantener temporalmente para compatibilidad)
  // TODO: Remover cuando auto-save esté completamente probado
  // Cart shipping cost - SOLO para items seleccionados (con checkbox marcado)
  // ✅ ORQUESTADOR: BD calcula peso y cantidad directamente
  const { data: cartShippingCost, isLoading: isLoadingShippingCost } = useCartShippingCostView(
    b2bSelectedIds,
    undefined, // ✅ Ya no necesario - BD tiene las cantidades actualizadas
    selectedShippingTypeId
  );

  console.log('📊 SellerCartPage - shipping state:', {
    selectedShippingTypeId,
    cartShippingCost,
    isLoadingShippingCost,
    b2bSelectedIdsCount: b2bSelectedIds.size
  });

  const subtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.cantidad, 0);
  const allSelected = items.length > 0 && items.every(item => b2bSelectedIds.has(item.id));
  const someSelected = selectedItems.length > 0;
  
  // ✅ ÚNICA FUENTE DE COSTO DE ENVÍO: cartShippingCost (con tier seleccionado)
  const shippingCostAmount = cartShippingCost?.shipping_cost || 0;
  
  // Total = subtotal + shipping ONLY if checkbox is checked
  const totalEstimado = subtotal + (includeShippingInTotal ? shippingCostAmount : 0);
  
  console.log('💰 SellerCartPage - CÁLCULO DE TOTAL:', {
    subtotal: subtotal.toFixed(2),
    shippingCostAmount: shippingCostAmount.toFixed(2),
    includeShippingInTotal,
    totalEstimado: totalEstimado.toFixed(2),
    fuente: 'cartShippingCost (con tier seleccionado)',
    selectedTier: selectedShippingTypeId,
    cartShippingCostRaw: cartShippingCost
  });
  
  // Check if costs are still loading/calculating
  const isCostCalculating = isLoadingShippingCost;

  // Prepare cart items for ShippingTypeSelector (SOLO para modo preview sin itemIds guardados)
  // NOTA: Ya no se usa en modo normal porque pasamos itemIds directamente
  const cartItemsForShipping = useMemo(() => {
    return selectedItems.map(item => {
      const shippingInfo = shippingCosts?.itemCosts?.find(
        sc => sc.productId === item.productId && sc.variantId === (item.variantId || undefined)
      );
      return {
        product_id: item.productId,
        variant_id: item.variantId || undefined,
        weight_kg: shippingInfo?.weight_kg || 0,
        quantity: item.cantidad,
      };
    });
  }, [selectedItems, shippingCosts]);

  // Calculate profit analysis for SELECTED items only using BusinessPanel view data
  // Shipping costs are ALREADY INCLUDED in suggestedPVP from the view
  const profitAnalysis = useMemo(() => {
    let totalInversion = 0;     // Total cost (precio B2B * cantidad)
    let totalVenta = 0;         // Total retail (precio de venta * cantidad) [includes shipping]
    let totalShippingCost = 0;  // Total shipping cost (for reference only)
    let ganancia = 0;           // Profit (totalVenta - totalInversion) [shipping already in totalVenta]
    let margen = 0;             // Profit margin percentage

    selectedItems.forEach(item => {
      const costoItem = item.precioB2B * item.cantidad;
      
      // Get suggested PVP from BusinessPanel view (already includes shipping cost)
      const key = item.variantId 
        ? `${item.productId}-${item.variantId}`
        : item.productId;
      const businessPanelData = businessPanelDataMap.get(key);
      const suggestedPVP = businessPanelData?.suggested_pvp_per_unit || (item.precioB2B * 2.5);
      
      const ventaItem = suggestedPVP * item.cantidad;
      
      // Get shipping cost for this item (already distributed by weight in the hook) - for tracking only
      const itemShippingCost = shippingCosts?.itemCosts?.find(
        sc => sc.productId === item.productId && sc.variantId === (item.variantId || undefined)
      )?.shippingCost || 0;
      
      const totalItemShippingCost = itemShippingCost * item.cantidad;
      
      totalInversion += costoItem;
      totalVenta += ventaItem;
      totalShippingCost += totalItemShippingCost;
    });

    ganancia = totalVenta - totalInversion;
    margen = totalVenta > 0 ? (ganancia / totalVenta) * 100 : 0;

    return {
      inversion: totalInversion,
      venta: totalVenta,
      ganancia: ganancia,
      margen: margen,
      totalShippingCost: totalShippingCost
    };
  }, [selectedItems, businessPanelDataMap, shippingCosts]);

  // Consolidate BusinessPanel data from v_business_panel_data for all selected items
  const consolidatedBusinessPanelData = useMemo(() => {
    if (selectedItems.length === 0) return null;

    let totalInvestment = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalShippingByView = 0;
    let itemCount = 0;

    selectedItems.forEach(item => {
      const key = item.variantId 
        ? `${item.productId}-${item.variantId}`
        : item.productId;
      const bpData = businessPanelDataMap.get(key);

      if (bpData) {
        // Accumulate totals from v_business_panel_data
        totalInvestment += (bpData.investment_1unit * item.cantidad);
        totalRevenue += (bpData.revenue_1unit * item.cantidad);
        totalProfit += (bpData.profit_1unit * item.cantidad);
        totalShippingByView += ((bpData.shipping_cost_per_unit || 0) * item.cantidad);
        itemCount++;
      }
    });

    // Return consolidated data that matches the view calculations
    return {
      investment_1unit: itemCount > 0 ? totalInvestment / totalQuantity : 0,
      revenue_1unit: itemCount > 0 ? totalRevenue / totalQuantity : 0,
      profit_1unit: itemCount > 0 ? totalProfit / totalQuantity : 0,
      suggested_pvp_per_unit: itemCount > 0 ? totalRevenue / totalQuantity : 0,
      shipping_cost_per_unit: itemCount > 0 ? totalShippingByView / totalQuantity : 0,
      margin_percentage: itemCount > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    };
  }, [selectedItems, businessPanelDataMap, totalQuantity]);

  // Prepare data for SuggestedPricesDetailModal
  const modalData = useMemo(() => {
    const items_for_modal = selectedItems.map(item => {
      const key = item.variantId 
        ? `${item.productId}-${item.variantId}`
        : item.productId;
      const businessPanelData = businessPanelDataMap.get(key);
      const costPerUnit = item.precioB2B;
      
      // Find shipping cost for this item
      const shippingInfo = shippingCosts?.itemCosts?.find(
        sc => sc.productId === item.productId && sc.variantId === (item.variantId || undefined)
      ) || { weight_kg: 0, shippingCost: 0 };

      // Datos pre-calculados de v_business_panel_data (fuente de verdad)
      const shippingCostPerUnit = businessPanelData?.shipping_cost_per_unit ?? shippingInfo.shippingCost ?? 0;
      const suggestedPvpPerUnit = businessPanelData?.suggested_pvp_per_unit ?? (costPerUnit + shippingCostPerUnit);
      const profitPerUnit       = businessPanelData?.profit_1unit ?? shippingCostPerUnit;
      const marginPercentage    = businessPanelData?.margin_percentage ?? 0;
      
      return {
        productId: item.productId,
        variantId: item.variantId,
        itemName: item.name,
        quantity: item.cantidad,
        costPerUnit,
        weight_kg: shippingInfo.weight_kg || 0,
        shippingCostPerUnit,
        suggestedPvpPerUnit,
        profitPerUnit,
        marginPercentage,
      };
    });

    return { items: items_for_modal };
  }, [selectedItems, businessPanelDataMap, shippingCosts]);

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

  // ⚠️ DEPRECADO: Update manual (reemplazado por auto-save)
  // Mantener solo para removeItem cuando qty < 1
  const updateQuantityManual = async (itemId: string, newQty: number) => {
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

  // ✅ UPDATE DIRECTO: Actualiza local + DB inmediatamente
  const updateQuantity = async (itemId: string, newQty: number) => {
    // Si la cantidad es 0, preguntar antes de eliminar
    if (newQty === 0) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        handleRemoveItem(item.id, item.name);
      }
      return;
    }
    
    // Encontrar el item
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    // Marcar como pendiente y actualizar timestamp
    pendingUpdatesRef.current.add(itemId);
    lastUpdateTimeRef.current = Date.now();
    
    // 1. UPDATE OPTIMISTA: Actualizar estado local inmediatamente
    const newSubtotal = item.precioB2B * newQty;
    setItems(prevItems => 
      prevItems.map(i => 
        i.id === itemId 
          ? { ...i, cantidad: newQty, subtotal: newSubtotal }
          : i
      )
    );
    
    // 2. GUARDAR EN DB inmediatamente
    try {
      const { error } = await supabase
        .from('b2b_cart_items')
        .update({
          quantity: newQty,
          total_price: newSubtotal
        })
        .eq('id', itemId);

      if (error) throw error;
      
      // Invalidar todas las queries de logística y shipping para refrescar en tiempo real
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cart-shipping-cost-selected'] }),
        queryClient.invalidateQueries({ queryKey: ['cart-shipping-cost-logistics'] }),
        queryClient.invalidateQueries({ queryKey: ['cart-shipping-cost'] }),
        queryClient.invalidateQueries({ queryKey: ['b2b-cart-logistics'] }),
        queryClient.invalidateQueries({ queryKey: ['cart-items'] }),
      ]);
      
      // Limpiar pending después de guardar exitosamente
      setTimeout(() => {
        pendingUpdatesRef.current.delete(itemId);
      }, 500);
      
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Error al actualizar la cantidad');
      // Revertir cambio local en caso de error
      pendingUpdatesRef.current.delete(itemId);
      lastUpdateTimeRef.current = 0;
      refetch();
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

      // Open responsive variant drawer (works for mobile, tablet, and desktop)
      setSelectedProductForVariants(uiProduct);

      console.log('Variant drawer opened successfully');
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
          {/* Cart mode tabs */}
          <CartModeTabs b2bCount={items.length} />
          {isLoading ? (
            <div className="space-y-4 py-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-lg animate-pulse">
                  <div className="h-16 w-16 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-5 w-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
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
                        {/* ✅ Auto-save indicator - discreto */}
                        {isAutoSaving && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-gray-600">
                        {selectedItems.length} de {items.length} seleccionados
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 ml-7">
                      Cantidad seleccionada: {totalQuantity}
                    </p>
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
                                const logisticsLabel = cartLogistics.shippingCostLabel === '-' 
                                  ? '-' 
                                  : `+$${(itemLogistics.logisticsCost * item.cantidad).toFixed(2)}`;
                                return (
                                  <div className="flex items-center gap-3 mt-1 text-[10px]">
                                    <span className="text-blue-600 flex items-center gap-0.5">
                                      <Truck className="w-2.5 h-2.5" />
                                      {logisticsLabel}
                                    </span>
                                    <span className="text-amber-600 flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      {itemLogistics.estimatedDays.min}-{itemLogistics.estimatedDays.max}d
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            {/* Quantity Selector & Subtotal */}
                            <div className="flex items-center justify-between gap-3 mt-2">
                              <QuantitySelector
                                value={item.cantidad}
                                onChange={(newQty) => updateQuantity(item.id, newQty)}
                                min={1}
                                max={999}
                                size="sm"
                              />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm font-bold cursor-help" style={{ color: '#071d7f' }}>
                                      ${item.subtotal.toFixed(2)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">
                                    <div className="space-y-0.5">
                                      <p>Subtotal: ${item.subtotal.toFixed(2)}</p>
                                      <p className="text-muted-foreground">
                                        {item.cantidad} × ${(item.subtotal / item.cantidad).toFixed(2)}
                                      </p>
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

                    {/* Shipping Cost & Type Selection */}
                    {someSelected && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200 space-y-2">
                        {/* Checkbox y costo */}
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="include-shipping"
                            checked={includeShippingInTotal}
                            onCheckedChange={(checked) => setIncludeShippingInTotal(!!checked)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <label
                              htmlFor="include-shipping"
                              className="text-xs font-medium text-blue-900 cursor-pointer flex items-center gap-1"
                            >
                              {isCostCalculating || isCalculatingAutoShipping ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Truck className="w-3 h-3" />
                              )}
                              Incluir Costo de Envío
                            </label>
                            
                            {/* Mostrar costo si ya fue calculado */}
                            {selectedShippingTypeId && autoSaveShippingCost && (
                              <div className="flex justify-end items-center mt-1">
                                <span className="text-xs font-bold text-blue-900">
                                  ${autoSaveShippingCost.total_cost_with_type.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Selector de tipo de envío */}
                        <div className="pt-2 border-t border-blue-200">
                          <ShippingTypeSelector
                            itemIds={Array.from(b2bSelectedIds)}
                            countryId={cartCountryId}
                            onShippingTypeChange={(typeId, summary) => {
                              console.log('📬 SellerCartPage received shipping change:', {
                                typeId,
                                summary,
                                previousTypeId: selectedShippingTypeId
                              });
                              setSelectedShippingTypeId(typeId);
                              setShippingSummary(summary);
                            }}
                            compact={true}
                          />
                        </div>
                      </div>
                    )}

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
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        {isCostCalculating && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        )}
                        Total Estimado:
                      </span>
                      <span className="text-lg font-bold flex items-center gap-1" style={{ color: '#071d7f' }}>
                        {isCostCalculating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-blue-600">Calculando...</span>
                          </>
                        ) : (
                          `$${totalEstimado.toFixed(2)}`
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {isCostCalculating
                        ? 'Actualizando costos de logística...' 
                        : includeShippingInTotal
                          ? `Productos + Logística (${selectedItems.length} items)`
                          : `Solo productos (${selectedItems.length} items)`
                      }
                    </p>
                  </div>

                  {/* Business Panel */}
                  {selectedItems.length > 0 && consolidatedBusinessPanelData && (
                    <div className="px-2 py-3 border-b border-gray-200 space-y-2">
                      <BusinessPanel
                        investment={profitAnalysis.inversion}
                        suggestedPricePerUnit={consolidatedBusinessPanelData.suggested_pvp_per_unit}
                        quantity={totalQuantity}
                        businessPanelData={consolidatedBusinessPanelData as any}
                        className="bg-blue-50 border-blue-200"
                      />
                      
                      {/* Button to open detailed prices modal */}
                      <button
                        onClick={() => setShowSuggestedPricesModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded font-medium text-sm transition"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Ver Precios de Venta Sugeridos
                      </button>
                      
                      {consolidatedBusinessPanelData && consolidatedBusinessPanelData.shipping_cost_per_unit * totalQuantity > 0 && (
                        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                          <p className="text-blue-900">
                            <span className="font-semibold">Costo de logística incluido:</span> ${(consolidatedBusinessPanelData.shipping_cost_per_unit * totalQuantity).toFixed(2)}
                          </p>
                          <p className="text-blue-700 mt-1">
                            Tu ganancia neta: <span className="font-bold text-green-700">${(consolidatedBusinessPanelData.profit_1unit * totalQuantity).toFixed(2)}</span>
                          </p>
                        </div>
                      )}
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
                          {/* Quantity Selector & Subtotal */}
                          <div className="flex items-center justify-between gap-3 mt-2">
                            <QuantitySelector
                              value={item.cantidad}
                              onChange={(newQty) => updateQuantity(item.id, newQty)}
                              min={1}
                              max={999}
                              size="sm"
                            />
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

                {/* Total en el Medio - Clickeable para abrir resumen */}
                <Badge 
                  variant="outline" 
                  className="text-sm border-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-green-50 transition" 
                  style={{ borderColor: '#29892a', color: '#29892a' }}
                  onClick={() => setShowOrderSummaryDrawer(true)}
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                  ${subtotal.toFixed(2)}
                </Badge>

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


      {/* Variant Selection Drawer - Responsive: Mobile/Tablet: Bottom | Desktop: Right Side */}
      {selectedProductForVariants && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[60]"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
            onClick={() => {
              setSelectedProductForVariants(null);
              setVariantSelections([]);
              setVariantImage(null);
            }}
          />
          
          {/* Responsive Panel - Bottom on mobile, Right side on desktop */}
          <aside
            onClick={(e) => e.stopPropagation()}
            className="fixed bg-background shadow-2xl flex flex-col z-[61]
                       bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl
                       md:top-0 md:bottom-auto md:left-auto md:right-0 md:rounded-none md:border-l md:w-[400px] md:h-screen md:max-h-screen"
            style={{ 
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            {/* Header - Desktop only shows close button */}
            <div className="hidden md:flex items-center justify-between p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-bold text-foreground">Seleccionar variantes</h3>
              <button 
                onClick={() => {
                  setSelectedProductForVariants(null);
                  setVariantSelections([]);
                  setVariantImage(null);
                }}
                className="p-1 hover:bg-muted rounded-full transition"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Product Info - Shows on both mobile and desktop */}
            <div className="py-3 px-4 border-b flex-shrink-0 bg-white flex items-start gap-3">
              <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                <img 
                  src={variantImage || selectedProductForVariants.images?.[0] || '/placeholder.svg'} 
                  alt={selectedProductForVariants.nombre}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm md:text-base font-semibold line-clamp-2">{selectedProductForVariants.nombre}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecciona variantes para agregar al carrito
                </p>
              </div>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-4">
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
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-semibold text-sm inline-block">
                      {variantSelections.reduce((sum, s) => sum + s.quantity, 0)} uds
                    </span>
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
                    const attrCombo = v.attribute_combination || {};
                    const colorVal = attrCombo.color || v.option_value || '';
                    const sizeVal = attrCombo.size || '';
                    const labelParts = [colorVal, sizeVal].filter(Boolean);
                    const label = v.name || labelParts.join(' / ') || v.sku;
                    
                    return {
                      id: v.id,
                      sku: v.sku,
                      label,
                      precio: v.precio_b2b_final || v.cost_price || v.price || selectedProductForVariants.costB2B || 0,
                      precio_b2b_final: v.precio_b2b_final,
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

            {/* Actions Footer */}
            <div className="p-2 md:p-4 border-t bg-background flex gap-2 flex-shrink-0">
              <Button
                onClick={() => {
                  setSelectedProductForVariants(null);
                  setVariantSelections([]);
                  setVariantImage(null);
                }}
                variant="outline"
                className="flex-1 h-9 md:h-10 text-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddVariantsToCart}
                disabled={isAddingVariant || variantSelections.length === 0}
                className="flex-1 h-9 md:h-10 text-sm text-white"
                style={{ backgroundColor: '#071d7f' }}
              >
                {isAddingVariant ? (
                  <>
                    <Loader2 className="h-3 md:h-4 w-3 md:w-4 mr-1 md:mr-2 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-3 md:h-4 w-3 md:w-4 mr-1 md:mr-2" />
                    Agregar ({variantSelections.reduce((sum, s) => sum + s.quantity, 0)})
                  </>
                )}
              </Button>
            </div>
          </aside>
        </>
      )}

      {/* Suggested Prices Detail Modal */}
      <SuggestedPricesDetailModal
        isOpen={showSuggestedPricesModal}
        onClose={() => setShowSuggestedPricesModal(false)}
        items={modalData.items}
      />

      {/* Order Summary Bottom Sheet for Mobile - Pure CSS, no Vaul */}
      {showOrderSummaryDrawer && (
        <div className="fixed inset-0 z-[10000]" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowOrderSummaryDrawer(false)}
          />
          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0 h-[88vh] flex flex-col rounded-t-[10px] border bg-background z-[10001]">
            {/* Drag handle visual */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-muted" />
            </div>
            {/* Header */}
            <div className="grid gap-1.5 px-4 pb-3 text-center sm:text-left border-b flex-shrink-0">
              <h2 className="text-lg font-semibold leading-none tracking-tight">Resumen del Pedido</h2>
              <p className="text-sm text-muted-foreground">
                Procesa descuentos y asientos luego confirmar precio final
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4" style={{ touchAction: 'pan-y', overscrollBehavior: 'none' }}>
            <div className="space-y-3 py-4">
              {/* Pricing Details */}
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">Subtotal Productos:</span>
                  <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
                </div>

                {/* Shipping Cost & Type Selection */}
                {someSelected && (
                  <div className="p-2 bg-blue-50 rounded border border-blue-200 space-y-2">
                    {/* Checkbox y costo */}
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="include-shipping-mobile"
                        checked={includeShippingInTotal}
                        onCheckedChange={(checked) => setIncludeShippingInTotal(!!checked)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor="include-shipping-mobile"
                          className="text-xs font-medium text-blue-900 cursor-pointer flex items-center gap-1"
                        >
                          {isCostCalculating || isCalculatingAutoShipping ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Truck className="w-3 h-3" />
                          )}
                          Incluir Costo de Envío
                        </label>
                        
                        {/* Mostrar costo si ya fue calculado */}
                        {selectedShippingTypeId && autoSaveShippingCost && (
                          <div className="flex justify-end items-center mt-1">
                            <span className="text-xs font-bold text-blue-900">
                              ${autoSaveShippingCost.total_cost_with_type.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selector de tipo de envío */}
                    <div className="pt-2 border-t border-blue-200">
                      <ShippingTypeSelector
                        cartItems={cartItemsForShipping}
                        countryId={cartCountryId}
                        onShippingTypeChange={(typeId, summary) => {
                          setSelectedShippingTypeId(typeId);
                          setShippingSummary(summary);
                        }}
                        compact={true}
                      />
                    </div>
                  </div>
                )}

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
              <div className="p-3 bg-gradient-to-b from-gray-50 to-white rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    {isCostCalculating && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    )}
                    Total Estimado:
                  </span>
                  <span className="text-lg font-bold flex items-center gap-1" style={{ color: '#071d7f' }}>
                    {isCostCalculating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-blue-600 text-sm">Calculando...</span>
                      </>
                    ) : (
                      `$${totalEstimado.toFixed(2)}`
                    )}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {isCostCalculating
                    ? 'Actualizando costos de logística...' 
                    : includeShippingInTotal
                      ? `Productos + Logística (${selectedItems.length} items)`
                      : `Solo productos (${selectedItems.length} items)`
                  }
                </p>
              </div>

              {/* Business Panel */}
              {selectedItems.length > 0 && consolidatedBusinessPanelData && (
                <div className="space-y-2">
                  <BusinessPanel
                    investment={profitAnalysis.inversion}
                    suggestedPricePerUnit={consolidatedBusinessPanelData.suggested_pvp_per_unit}
                    quantity={totalQuantity}
                    businessPanelData={consolidatedBusinessPanelData as any}
                    className="bg-blue-50 border-blue-200"
                  />
                  
                  {/* Button to open detailed prices modal */}
                  <button
                    onClick={() => {
                      setShowOrderSummaryDrawer(false);
                      setShowSuggestedPricesModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded font-medium text-sm transition"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Ver Precios de Venta Sugeridos
                  </button>
                  
                  {consolidatedBusinessPanelData && consolidatedBusinessPanelData.shipping_cost_per_unit * totalQuantity > 0 && (
                    <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                      <p className="text-blue-900">
                        <span className="font-semibold">Costo de logística incluido:</span> ${(consolidatedBusinessPanelData.shipping_cost_per_unit * totalQuantity).toFixed(2)}
                      </p>
                      <p className="text-blue-700 mt-1">
                        Tu ganancia neta: <span className="font-bold text-green-700">${(consolidatedBusinessPanelData.profit_1unit * totalQuantity).toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Methods */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Aceptamos:</p>
                <div className="grid grid-cols-5 gap-1">
                  {/* Credit Cards Section */}
                  {paymentMethods.includes('Tarjetas') && (
                    <>
                      <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center" title="VISA">
                        <img src="/visa.png" alt="VISA" className="h-4 w-auto" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center" title="Mastercard">
                        <img src="/mastercard.png" alt="Mastercard" className="h-4 w-auto" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center" title="American Express">
                        <img src="/american express.png" alt="American Express" className="h-4 w-auto" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center" title="Apple Pay">
                        <img src="/apple pay.png" alt="Apple Pay" className="h-4 w-auto" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center" title="Google Pay">
                        <img src="/google pay.png" alt="Google Pay" className="h-4 w-auto" />
                      </div>
                    </>
                  )}

                  {/* Transferencia */}
                  {paymentMethods.includes('Transferencia') && (
                    <div className="bg-white border border-gray-200 rounded p-1 flex items-center justify-center" title="Transferencia Bancaria">
                      <Banknote className="h-4 w-4" style={{ color: '#071d7f' }} />
                    </div>
                  )}

                  {/* MonCash */}
                  {paymentMethods.includes('MonCash') && (
                    <div className="bg-white border border-gray-200 rounded p-2 flex items-center justify-center" title="MonCash">
                      <Banknote className="h-5 w-5" style={{ color: '#94111f' }} />
                    </div>
                  )}

                  {/* NatCash */}
                  {paymentMethods.includes('NatCash') && (
                    <div className="bg-white border border-gray-200 rounded p-2 flex items-center justify-center" title="NatCash">
                      <Banknote className="h-5 w-5" style={{ color: '#1e40af' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Checkout Buttons */}
              <div className="space-y-2 pb-4">
                {!isCartValid && (
                  <div className="text-xs text-amber-600 text-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Alcanza los mínimos para continuar
                  </div>
                )}
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      setShowOrderSummaryDrawer(false);
                      handleWhatsAppContact();
                    }}
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
                      onClick={() => setShowOrderSummaryDrawer(false)}
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
                      {!someSelected ? 'Selecciona' : `Comprar (${totalQuantity})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  );
};

export default SellerCartPage;
