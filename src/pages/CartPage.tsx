import { useTranslation } from 'react-i18next';
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ShoppingCart, Trash2, Package, MessageCircle, Banknote, Wallet, DollarSign, X, Loader2, Check, Palette, Ruler, Minus, Plus, Share2, Copy, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useB2CCartItems, B2CCartItem } from "@/hooks/useB2CCartItems";
import { useActiveB2COrder } from "@/hooks/useB2COrders";
import { B2CCartLockBanner } from "@/components/checkout/B2CCartLockBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { UserRole } from "@/types/auth";
import CartModeTabs from "@/components/cart/CartModeTabs";
import { supabase } from "@/integrations/supabase/client";
import { useCartSelectionStore } from "@/stores/useCartSelectionStore";
import { Checkbox } from "@/components/ui/checkbox";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { useB2CCatalogVariants, B2CCatalogVariant } from "@/hooks/useB2CCatalogVariants";
import { addItemB2C } from "@/services/cartService";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── B2C Cart Variant Drawer helpers ───────────────────────────────────────────
const ATTR_CONFIG: Record<string, { icon: typeof Palette; displayName: string; order: number }> = {
  color:  { icon: Palette, displayName: 'Color', order: 1 },
  size:   { icon: Ruler,   displayName: 'Talla', order: 2 },
  talla:  { icon: Ruler,   displayName: 'Talla', order: 2 },
  age:    { icon: Ruler,   displayName: 'Edad',  order: 3 },
};

const COLOR_HEX: Record<string, string> = {
  blanco: '#FFFFFF', white: '#FFFFFF', negro: '#000000', black: '#000000',
  rojo: '#EF4444', red: '#EF4444', azul: '#3B82F6', blue: '#3B82F6',
  verde: '#22C55E', green: '#22C55E', amarillo: '#EAB308', yellow: '#EAB308',
  rosa: '#EC4899', pink: '#EC4899', morado: '#A855F7', purple: '#A855F7',
  naranja: '#F97316', orange: '#F97316', beige: '#D4B896', marron: '#8B4513',
  brown: '#8B4513', navy: '#1E3A5A', gris: '#6B7280', gray: '#6B7280',
  gold: '#FFD700', silver: '#C0C0C0', cream: '#FFFDD0', coral: '#FF7F50',
};

function getHex(name: string): string | null {
  return COLOR_HEX[name.toLowerCase()] ?? null;
}

const CartPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items: rawItems, isLoading, refetch } = useB2CCartItems();
  const { isCartLocked } = useActiveB2COrder();
  const isMobile = useIsMobile();
  const { user, role } = useAuth();

  // ── Optimistic state (same pattern as SellerCartPage) ──────────────────────
  const [items, setItems] = useState<B2CCartItem[]>(rawItems);
  const pendingUpdatesRef = useRef(new Set<string>());
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
    if (pendingUpdatesRef.current.size > 0 || timeSinceLastUpdate < 2000) return;
    setItems(rawItems);
  }, [rawItems]);

  // ── Variant drawer state ───────────────────────────────────────────────────
  const [selectedItemForVariants, setSelectedItemForVariants] = useState<B2CCartItem | null>(null);
  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  // B2B-style attribute selectors: { color: 'Rojo', size: 'M' }
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  const { data: catalogVariants = [], isLoading: isLoadingVariants } = useB2CCatalogVariants(
    selectedItemForVariants?.sellerCatalogId ?? null
  );

  // Build B2B-style attribute options from catalogVariants
  const drawerAttrOptions = useMemo(() => {
    const opts: Record<string, Set<string>> = {};
    catalogVariants.forEach(v => {
      const attrs = v.variantAttributes || {};
      if (v.color) { if (!opts.color) opts.color = new Set(); opts.color.add(v.color); }
      if (v.size)  { if (!opts.size)  opts.size  = new Set(); opts.size.add(v.size);  }
      Object.entries(attrs).forEach(([k, val]) => {
        if (val && k !== 'color' && k !== 'size') {
          if (!opts[k]) opts[k] = new Set();
          opts[k].add(String(val));
        }
      });
    });
    const result: Record<string, string[]> = {};
    Object.entries(opts).forEach(([k, s]) => { result[k] = Array.from(s).sort(); });
    return result;
  }, [catalogVariants]);

  const drawerAttrTypes = useMemo(() =>
    Object.keys(drawerAttrOptions).sort((a, b) =>
      (ATTR_CONFIG[a]?.order ?? 99) - (ATTR_CONFIG[b]?.order ?? 99)
    ),
  [drawerAttrOptions]);

  // Build image map: attrType → value → imageUrl
  const drawerImageMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    catalogVariants.forEach(v => {
      const img = v.images?.[0];
      if (!img) return;
      if (v.color) { if (!map.color) map.color = {}; if (!map.color[v.color]) map.color[v.color] = img; }
      if (v.size)  { if (!map.size)  map.size  = {}; if (!map.size[v.size])   map.size[v.size]   = img; }
    });
    return map;
  }, [catalogVariants]);

  // Find the variant that matches current attribute selection
  const matchingVariant = useMemo((): B2CCatalogVariant | null => {
    if (drawerAttrTypes.length === 0) return null;
    return catalogVariants.find(v => {
      return drawerAttrTypes.every(type => {
        const sel = selectedAttrs[type];
        if (!sel) return false;
        if (type === 'color') return v.color === sel;
        if (type === 'size' || type === 'talla') return v.size === sel;
        return v.variantAttributes?.[type] === sel;
      });
    }) ?? null;
  }, [selectedAttrs, catalogVariants, drawerAttrTypes]);

  // Update preview image when matching variant changes
  useEffect(() => {
    if (matchingVariant?.images?.[0]) setActivePreviewImage(matchingVariant.images[0]);
  }, [matchingVariant]);

  // Auto-select first option for each type when drawer opens
  useEffect(() => {
    if (!selectedItemForVariants || catalogVariants.length === 0) { setSelectedAttrs({}); return; }
    if (Object.keys(selectedAttrs).length > 0) return;
    // Try to pre-select the attributes of the currently clicked item
    const current = items.find(i => i.id === selectedItemForVariants.id);
    const firstDefaults: Record<string, string> = {};
    drawerAttrTypes.forEach(type => {
      const firstOpt = drawerAttrOptions[type]?.[0];
      if (firstOpt) firstDefaults[type] = firstOpt;
    });
    if (current?.color && drawerAttrOptions.color?.includes(current.color)) firstDefaults.color = current.color;
    if (current?.size && drawerAttrOptions.size?.includes(current.size)) firstDefaults.size = current.size;
    setSelectedAttrs(firstDefaults);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemForVariants, catalogVariants]);

  // Reset drawer fully when closed
  useEffect(() => {
    if (!selectedItemForVariants) {
      setVariantQtys({});
      setSelectedAttrs({});
      setActivePreviewImage(null);
    }
  }, [selectedItemForVariants]);

  // Pre-fill qty for the matching variant from existing cart
  useEffect(() => {
    if (!matchingVariant) return;
    const existingItem = items.find(
      i => i.sellerCatalogId === selectedItemForVariants?.sellerCatalogId
        && i.variantId === matchingVariant.productVariantId
    );
    setVariantQtys(prev => ({
      ...prev,
      [matchingVariant.id]: prev[matchingVariant.id] ?? (existingItem?.quantity ?? 0),
    }));
  }, [matchingVariant, items, selectedItemForVariants]);

  const [isNegotiating, setIsNegotiating] = useState(false);
  const [showClearCartDialog, setShowClearCartDialog] = useState(false);
  const [showRemoveItemDialog, setShowRemoveItemDialog] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Cart selection store
  const { 
    b2cSelectedIds, 
    toggleB2CItem, 
    selectAllB2C, 
    deselectAllB2C, 
    isB2CItemSelected 
  } = useCartSelectionStore();

  // Auto-select all items when cart loads for the first time
  useEffect(() => {
    if (items.length > 0 && b2cSelectedIds.size === 0) {
      selectAllB2C(items.map(i => i.id));
    }
  }, [items, b2cSelectedIds.size, selectAllB2C]);

  // Calculate totals based on selected items
  const selectedItems = useMemo(() => 
    items.filter(item => b2cSelectedIds.has(item.id)), 
    [items, b2cSelectedIds]
  );
  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const allSelected = items.length > 0 && items.every(item => b2cSelectedIds.has(item.id));
  const someSelected = selectedItems.length > 0;

  // Show tabs for sellers to switch between B2C and B2B carts
  const isB2BUser = role === UserRole.SELLER || role === UserRole.ADMIN;

  // Show confirmation dialog for removing item
  const handleRemoveItem = (itemId: string, itemName: string) => {
    setItemToRemove({ id: itemId, name: itemName });
    setShowRemoveItemDialog(true);
  };

  // Remove item from cart after confirmation
  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('b2c_cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      await refetch(false);

      toast.success(t('cart.productRemoved'));
      setShowRemoveItemDialog(false);
      setItemToRemove(null);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error(t('cart.removeError'));
    }
  };

  // ── Optimistic quantity update ────────────────────────────────────────────
  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity === 0) {
      const item = items.find(i => i.id === itemId);
      if (item) { setItemToRemove({ id: item.id, name: item.name }); setShowRemoveItemDialog(true); }
      return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    pendingUpdatesRef.current.add(itemId);
    lastUpdateTimeRef.current = Date.now();

    // 1. Update local state immediately
    const newTotalPrice = item.price * quantity;
    setItems(prev =>
      prev.map(i => i.id === itemId ? { ...i, quantity, totalPrice: newTotalPrice } : i)
    );

    // 2. Persist to DB
    try {
      const { error } = await supabase
        .from('b2c_cart_items')
        .update({ quantity, total_price: newTotalPrice })
        .eq('id', itemId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['b2c-cart-items'] });

      setTimeout(() => { pendingUpdatesRef.current.delete(itemId); }, 500);
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error(t('cart.quantityError'));
      pendingUpdatesRef.current.delete(itemId);
      lastUpdateTimeRef.current = 0;
      refetch(false);
    }
  };

  // Show confirmation dialog for clearing cart
  const handleClearCart = () => {
    setShowClearCartDialog(true);
  };

  // Clear entire cart after confirmation
  const clearCart = async () => {
    try {
      if (!user?.id) {
        toast.error(t('cart.userNotIdentified'));
        return;
      }

      // Use the latest open cart (legacy data may contain multiple open carts)
      const { data: cartData, error: cartError } = await supabase
        .from('b2c_carts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cartError || !cartData?.id) {
        toast.error(t('cart.noOpenCart'));
        return;
      }

      const { error: deleteError } = await supabase
        .from('b2c_cart_items')
        .delete()
        .eq('cart_id', cartData.id);

      if (deleteError) throw deleteError;

      await refetch(false);
      toast.success(t('cart.cartCleared'));
      setShowClearCartDialog(false);
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error(t('cart.clearError'));
    }
  };

  // Group items by store
  const itemsByStore = useMemo(() => {
    const grouped = new Map<string, typeof items>();
    items.forEach(item => {
      const storeKey = item.storeId || 'unknown';
      const existing = grouped.get(storeKey) || [];
      grouped.set(storeKey, [...existing, item]);
    });
    return grouped;
  }, [items]);

  // Get available payment methods based on store configurations
  const paymentMethods = useMemo(() => {
    const methods = new Set<string>();
    
    // Default payment methods - Tarjetas (Stripe via admin), MonCash and NatCash
    methods.add('Tarjetas');
    
    // Check if any store has MonCash or NatCash configured
    items.forEach(item => {
      if (item.storeMetadata?.moncash_info?.phone_number) {
        methods.add('MonCash');
      }
      if (item.storeMetadata?.natcash_info?.phone_number) {
        methods.add('NatCash');
      }
      if (item.storeMetadata?.bank_info?.account_number) {
        methods.add('Transferencia');
      }
    });

    // Always include these as default options
    methods.add('MonCash');
    methods.add('NatCash');

    return Array.from(methods);
  }, [items]);

  // Map payment method names to display info
  const getPaymentMethodDisplay = (method: string) => {
    const methodMap: Record<string, { label: string; color: string; abbr: string; icon?: any }> = {
      'visa': { label: 'Tarjetas', color: '#1435CB', abbr: 'Tarjetas', icon: 'card' },
      'mastercard': { label: 'Tarjetas', color: '#1435CB', abbr: 'Tarjetas', icon: 'card' },
      'amex': { label: 'Tarjetas', color: '#1435CB', abbr: 'Tarjetas', icon: 'card' },
      'American Express': { label: 'Tarjetas', color: '#1435CB', abbr: 'Tarjetas', icon: 'card' },
      'tarjeta': { label: 'Tarjetas', color: '#1435CB', abbr: 'Tarjetas', icon: 'card' },
      'tarjetas': { label: 'Tarjetas', color: '#1435CB', abbr: 'Tarjetas', icon: 'card' },
      'transferencia': { label: 'Transferencia', color: '#071d7f', abbr: 'Transferencia', icon: 'bank' },
      'transferencia bancaria': { label: 'Transferencia', color: '#071d7f', abbr: 'Transferencia', icon: 'bank' },
      'moncash': { label: 'MonCash', color: '#94111f', abbr: 'MonCash', icon: 'wallet' },
      'natcash': { label: 'NatCash', color: '#1e40af', abbr: 'NatCash', icon: 'wallet' },
      'efectivo': { label: 'Efectivo', color: '#8B7355', abbr: 'Efectivo', icon: 'dollar' },
      'tarjeta de credito': { label: 'Tarjetas', color: '#1435CB', abbr: 'Tarjetas', icon: 'card' },
      'paypal': { label: 'PayPal', color: '#003087', abbr: 'PayPal', icon: 'wallet' },
      'bitcoin': { label: 'Bitcoin', color: '#F7931A', abbr: 'BTC', icon: 'wallet' },
    };

    const lowerMethod = method.toLowerCase();
    return methodMap[lowerMethod] || { label: method, color: '#6B7280', abbr: method, icon: 'wallet' };
  };

  // ── Variant drawer: reconcile cart with new qty selections ──────────────
  const handleAddVariantsToCart = useCallback(async () => {
    if (!user?.id || !selectedItemForVariants) return;
    setIsAddingVariant(true);
    try {
      // Build map of existing cart rows for this catalog entry (by product_variants.id)
      const existingByVariantId = new Map<string, { id: string; qty: number; price: number }>();
      items
        .filter(i => i.sellerCatalogId === selectedItemForVariants.sellerCatalogId && i.variantId)
        .forEach(i => {
          existingByVariantId.set(i.variantId!, { id: i.id, qty: i.quantity, price: i.price });
        });

      for (const variant of catalogVariants) {
        const desiredQty = variantQtys[variant.id] ?? 0;
        // Match by productVariantId (= product_variants.id = b2c_cart_items.variant_id)
        const existing = existingByVariantId.get(variant.productVariantId);

        if (existing && desiredQty === 0) {
          // Remove
          await supabase.from('b2c_cart_items').delete().eq('id', existing.id);
        } else if (existing && desiredQty !== existing.qty) {
          // Update qty (use current seller price)
          await supabase
            .from('b2c_cart_items')
            .update({ quantity: desiredQty, unit_price: variant.price, total_price: variant.price * desiredQty })
            .eq('id', existing.id);
        } else if (!existing && desiredQty > 0) {
          // Add new variant row
          await addItemB2C({
            userId: user.id,
            sku: variant.sku,
            name: `${selectedItemForVariants.name} - ${[variant.color, variant.size].filter(Boolean).join(' / ')}`,
            price: variant.price,
            quantity: desiredQty,
            image: (variant.images?.[0]) ?? selectedItemForVariants.image ?? null,
            storeId: selectedItemForVariants.storeId,
            storeName: selectedItemForVariants.storeName,
            storeWhatsapp: selectedItemForVariants.storeWhatsapp,
            sellerCatalogId: selectedItemForVariants.sellerCatalogId,
            variant: {
              variantId: variant.productVariantId, // must be product_variants.id
              color: variant.color ?? undefined,
              size: variant.size ?? undefined,
              variantAttributes: variant.variantAttributes,
            },
          });
        }
      }

      toast.success('Carrito actualizado');
      setSelectedItemForVariants(null);
      setVariantQtys({});
      setSelectedAttrs({});
      setActivePreviewImage(null);
      await refetch(false);
    } catch (err) {
      console.error('Error updating variants:', err);
      toast.error('Error al actualizar variantes');
    } finally {
      setIsAddingVariant(false);
    }
  }, [user?.id, selectedItemForVariants, catalogVariants, variantQtys, items, refetch]);

  const handleNegotiate = (storeItems: typeof items) => {    const storeName = storeItems[0]?.storeName || 'Vendedor';
    const storeWhatsapp = storeItems[0]?.storeWhatsapp;
    const storeTotal = storeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const storeQty = storeItems.reduce((sum, item) => sum + item.quantity, 0);
    const customerName = user?.name || 'Cliente';
    
    const itemsList = storeItems
      .map((item, idx) => `${idx + 1}. ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`)
      .join('\n');
    
    const message = `📱 *Consulta de Pedido - ${storeName}*\n\n` +
      `Cliente: ${customerName}\n\n` +
      `*Detalle del pedido:*\n${itemsList}\n\n` +
      `*Total:* $${storeTotal.toFixed(2)}\n` +
      `*Unidades:* ${storeQty}\n\n` +
      `Me gustaría consultar sobre este pedido. ¿Está disponible?`;
    
    const whatsappUrl = `https://wa.me/${storeWhatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleWhatsAppSupport = () => {
    const customerName = user?.name || 'Cliente';
    const cartSummary = Array.from(itemsByStore.entries())
      .map(([_, storeItems]) => {
        const storeName = storeItems[0]?.storeName || 'Tienda';
        const items_text = storeItems
          .map((item, idx) => `• ${item.name} x${item.quantity}`)
          .join('\n');
        return `*${storeName}:*\n${items_text}`;
      })
      .join('\n\n');
    
    const message = `¡Hola! Soy ${customerName}\n\n` +
      `Tengo una consulta sobre mi carrito de compra:\n\n` +
      `${cartSummary}\n\n` +
      `*Total:* $${totalPrice.toFixed(2)}\n` +
      `*Unidades:* ${totalQuantity}\n\n` +
      `¿Podrían ayudarme?`;
    
    // Número de soporte (reemplazar con número real de soporte)
    const supportPhone = '5712345678'; // Cambiar al número real de soporte
    const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareCart = async () => {
    if (!user?.id || items.length === 0) return;
    setIsSharing(true);
    setShareCopied(false);
    try {
      const snapshot = items.map(item => ({
        sku: item.sku,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        storeId: item.storeId,
        storeName: item.storeName,
        storeWhatsapp: item.storeWhatsapp,
        sellerCatalogId: item.sellerCatalogId,
        color: item.color,
        size: item.size,
        variantId: item.variantId,
        variantAttributes: item.variantAttributes,
      }));

      const { data, error } = await (supabase as any)
        .from('shared_carts')
        .insert([{ created_by: user.id, items: snapshot }])
        .select('share_code')
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/carrito/compartido/${data.share_code}`;
      setShareLink(link);
      setShowShareDialog(true);
    } catch (err) {
      console.error('Error sharing cart:', err);
      toast.error('Error al compartir carrito');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      toast.success('Enlace copiado');
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleShareWhatsApp = () => {
    const message = `¡Mira mi carrito de compras! 🛒\n\n${items.length} productos · $${totalPrice.toFixed(2)}\n\n${shareLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isMobile && <GlobalHeader />}
      
      {/* Fixed Cart Header - Only Mobile */}
      {items.length > 0 && isMobile && (
        <div className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200">
          <div className="container mx-auto px-4 py-2">
            {/* Header */}
            <div 
              className="text-gray-900 p-1.5 rounded-lg flex items-center gap-1.5 bg-white border-b border-gray-200"
            >
              <ShoppingCart className="w-4 h-4" />
              <h1 className="font-bold text-sm">{t('cart.title')}</h1>
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">
                {items.length}
              </span>
            </div>

            {/* Summary */}
            <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 p-2 rounded-lg border border-gray-200">
              <div className="flex gap-4">
                <div>
                  <span className="text-gray-900">{t('cart.totalItems')}:</span>
                  <span className="font-bold ml-1 text-gray-900">{items.length}</span>
                </div>
                <div>
                  <span className="text-gray-900">{t('common.units')}:</span>
                  <span className="font-bold ml-1 text-gray-900">{totalQuantity}</span>
                </div>
              </div>
              <div>
                <span className="text-gray-900">Total:</span>
                <span className="font-bold ml-1 text-gray-900">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className={`flex-1 ${isMobile ? 'container mx-auto px-4 pb-40' : 'max-w-7xl mx-auto px-4 py-6'}`}>
        {/* Cart Lock Banner for pending payments */}
        <B2CCartLockBanner />
        {/* Cart mode tabs for sellers */}
        {isB2BUser && (
          <CartModeTabs b2cCount={items.length} />
        )}
        {items.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-2">{t('cart.empty')}</p>
            <p className="text-xs text-gray-500 mb-4">{t('cart.emptyMessage')}</p>
            <Button asChild style={{ backgroundColor: '#071d7f' }} className="text-white hover:opacity-90">
              <Link to="/">{t('cart.goToCatalog')}</Link>
            </Button>
          </div>
        ) : isMobile ? (
          // ========== LAYOUT MOBILE (sin cambios) ==========
          <>
            {/* Items Grouped by Store */}
            {Array.from(itemsByStore.entries()).map(([storeId, storeItems]) => {
              const storeName = storeItems[0]?.storeName || 'Tienda';
              const storeWhatsapp = storeItems[0]?.storeWhatsapp;
              const storeTotal = storeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

              return (
                <div key={storeId} className="mb-4">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Store Header */}
                    <div className="p-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-600" />
                        <h3 className="font-semibold text-sm text-gray-900">{storeName}</h3>
                      </div>
                      <button
                        onClick={() => handleNegotiate(storeItems)}
                       className="p-1.5 hover:bg-green-100 rounded transition flex-shrink-0"
                        title={t('common.contactStore', { store: storeName })}
                      >
                        <MessageCircle className="w-5 h-5" style={{ color: '#29892a' }} />
                      </button>
                    </div>

                    {/* Store Items */}
                    <div className="p-1 space-y-0 bg-white" style={{ backgroundColor: '#d9d9d9' }}>
                      {storeItems.map((item) => {
                        const isSelected = b2cSelectedIds.has(item.id);
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
                              onCheckedChange={() => toggleB2CItem(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="data-[state=checked]:bg-[#071d7f] data-[state=checked]:border-[#071d7f]"
                            />
                          </div>
                          {/* Product Image – click to open variant drawer */}
                          <button
                            onClick={() => setSelectedItemForVariants(item)}
                            className="flex-shrink-0 rounded-md bg-muted overflow-hidden border-none p-0 hover:opacity-80 transition"
                            style={{ width: '70px', height: '70px' }}
                            title="Cambiar variante"
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
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 line-clamp-1">
                                  {item.name}
                                </p>
                              </div>
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
                            
                            {/* Variant badges and Quantity Selector */}
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              {item.color && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                                  {item.color}
                                </span>
                              )}
                              {item.size && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                                  {item.size}
                                </span>
                              )}
                            </div>
                            
                            {/* Price */}
                            <div className="mt-1">
                              <span className="text-sm font-bold" style={{ color: '#29892a' }}>
                                ${item.price.toFixed(2)}
                              </span>
                            </div>

                            {/* Qty selector + subtotal */}
                            <div className="flex items-center justify-between mt-2">
                              <QuantitySelector
                                value={item.quantity}
                                onChange={(newQty) => updateQuantity(item.id, newQty)}
                                min={0}
                                max={999}
                                size="sm"
                              />
                              <span className="text-sm font-bold" style={{ color: '#071d7f' }}>
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>

                    {/* Store Actions */}
                    {storeWhatsapp && (
                      <Button
                        variant="outline"
                        onClick={() => handleNegotiate(storeItems)}
                        className="w-full border-green-500 text-green-600 hover:bg-green-50 gap-2"
                        size="sm"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Consultar a {storeName}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          // ========== LAYOUT PC (DOS COLUMNAS) ==========
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mt-1">
            <div className="pt-6 px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
            {/* COLUMNA IZQUIERDA - Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Items Header */}
                <div className="bg-gray-50 border-b border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={allSelected} 
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllB2C(items.map(i => i.id));
                          } else {
                            deselectAllB2C();
                          }
                        }}
                        className="data-[state=checked]:bg-[#071d7f] data-[state=checked]:border-[#071d7f]"
                      />
                      <ShoppingCart className="w-5 h-5" />
                      <h2 className="font-bold text-lg text-gray-900">{t('cart.title')}</h2>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-semibold">
                        {items.length} {t('common.products')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {selectedItems.length} {t('common.of')} {items.length} {t('common.selected')}
                      </span>
                      <button
                        onClick={handleClearCart}
                        className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1.5 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('common.empty')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Store Items Container */}
                <div className="divide-y divide-gray-200">
                  {Array.from(itemsByStore.entries()).map(([storeId, storeItems]) => {
                    const storeName = storeItems[0]?.storeName || 'Tienda';
                    const storeWhatsapp = storeItems[0]?.storeWhatsapp;

                    return (
                      <div key={storeId} className="p-4">
                        {/* Store Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-600" />
                            <h3 className="font-semibold text-gray-900">{storeName}</h3>
                          </div>
                          {storeWhatsapp && (
                            <button
                              onClick={() => handleNegotiate(storeItems)}
                              className="p-1.5 hover:bg-green-100 rounded transition"
                              title={t('common.contactStore', { store: storeName })}
                            >
                              <MessageCircle className="w-4 h-4" style={{ color: '#29892a' }} />
                            </button>
                          )}
                        </div>

                        {/* Store Items Grid */}
                        <div className="space-y-4">
                          {storeItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex gap-4 pb-4 border-b border-gray-100 last:border-b-0 last:pb-0 group hover:bg-gray-50 p-2 rounded transition"
                            >
                              {/* Checkbox */}
                              <div className="flex items-center pt-1">
                                <Checkbox 
                                  checked={b2cSelectedIds.has(item.id)}
                                  onCheckedChange={() => toggleB2CItem(item.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="data-[state=checked]:bg-[#071d7f] data-[state=checked]:border-[#071d7f]"
                                />
                              </div>

                              {/* Product Image – click to open variant drawer */}
                              <button
                                onClick={() => setSelectedItemForVariants(item)}
                                className="flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition w-24 h-24 border-none p-0"
                                title="Cambiar variante"
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

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <p 
                                    onClick={() => {
                                      const url = item.sellerCatalogId
                                        ? `/producto/catalogo/${item.sellerCatalogId}${item.storeId ? `?seller=${item.storeId}` : ''}`
                                        : `/producto/${item.sku}`;
                                      navigate(url);
                                    }}
                                    className="font-medium text-gray-900 line-clamp-1 cursor-pointer hover:text-blue-600 transition"
                                  >
                                    {item.name}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveItem(item.id, item.name);
                                    }}
                                    className="text-gray-400 hover:text-red-600 transition flex-shrink-0 p-1 hover:bg-red-50 rounded"
                                    title={t('cart.removeFromCart')}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Variant badges */}
                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                  {item.color && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                                      {item.color}
                                    </span>
                                  )}
                                  {item.size && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                                      Talla: {item.size}
                                    </span>
                                  )}
                                </div>

                                {/* Price and Qty Controls Row */}
                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex items-center gap-4">
                                    <span className="text-lg font-bold" style={{ color: '#29892a' }}>
                                      ${item.price.toFixed(2)}
                                    </span>
                                    <QuantitySelector
                                      value={item.quantity}
                                      onChange={(newQty) => updateQuantity(item.id, newQty)}
                                      min={0}
                                      max={999}
                                      size="sm"
                                    />
                                  </div>
                                  <span className="text-lg font-bold" style={{ color: '#071d7f' }}>
                                    ${(item.price * item.quantity).toFixed(2)}
                                  </span>
                                </div>


                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA - Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden sticky top-24">
                {/* Summary Header */}
                <div className="bg-gray-50 border-b border-gray-200 p-3">
                  <h2 className="font-bold text-base text-gray-900">{t('common.orderSummary')}</h2>
                  <p className="text-xs text-gray-600 mt-1">Procesa descuentos y asientos luego confirmar precio final</p>
                </div>

                {/* Product Images Carousel */}
                <div className="p-2 border-b border-gray-200 bg-gray-50">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {items.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 overflow-hidden relative group"
                      >
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute top-0.5 right-0.5 bg-blue-600 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
                          {item.quantity}
                        </div>
                      </div>
                    ))}
                    {items.length > 5 && (
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center font-bold text-gray-700 border border-gray-300 text-xs">
                        +{items.length - 5}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Details */}
                <div className="p-2 space-y-2 border-b border-gray-200">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{t('common.retailPrice')}:</span>
                    <span className="font-semibold text-gray-900">${totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{t('common.promotions')}:</span>
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
                    <span className="text-sm font-medium text-gray-700">{t('common.estimatedPrice')}:</span>
                    <span className="text-lg font-bold" style={{ color: '#071d7f' }}>
                      ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('cart.priceConfirmNote')}</p>
                </div>

                {/* Checkout Button and Support */}
                <div className="p-2 flex gap-2 justify-center">
                  <button
                    onClick={handleShareCart}
                    disabled={isSharing}
                    className="px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-2 bg-transparent border border-border hover:bg-muted"
                    title="Compartir carrito"
                  >
                    {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                    Compartir
                  </button>
                  {someSelected ? (
                    <Link
                      to="/checkout"
                      className="px-4 py-2 rounded-lg font-semibold text-xs text-white transition hover:opacity-90 flex items-center justify-center gap-2 shadow-lg"
                      style={{ backgroundColor: '#071d7f' }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {t('common.buy')} ({totalQuantity})
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg font-semibold text-xs text-white flex items-center justify-center gap-2 shadow-lg opacity-50 cursor-not-allowed"
                      style={{ backgroundColor: '#071d7f' }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {t('common.selectProducts')}
                    </button>
                  )}
                </div>

                {/* Payment Methods */}
                <div className="p-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">{t('common.weAccept')}:</p>
                  <div className="grid grid-cols-5 gap-1">
                    {/* Credit Cards Section - Show individual card types */}
                    {paymentMethods.includes('Tarjetas') && (
                      <>
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

                    {/* Other Payment Methods */}
                    {paymentMethods.map((method) => {
                      if (method === 'Tarjetas') return null; // Skip tarjetas as we handle it above
                      
                      const display = getPaymentMethodDisplay(method);
                      
                      let customContent = null;
                      if (method === 'Transferencia' || method.toLowerCase() === 'transferencia') {
                        customContent = (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: '#071d7f', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                            </div>
                            <span className="text-[8px] font-bold" style={{ color: '#071d7f' }}>BANCO</span>
                          </div>
                        );
                      } else if (method === 'MonCash' || method.toLowerCase() === 'moncash') {
                        customContent = (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: '#94111f' }}>
                              <span className="text-[5px] font-bold text-white">MC</span>
                            </div>
                            <span className="text-[8px] font-bold text-center" style={{ color: '#94111f' }}>MonCash</span>
                          </div>
                        );
                      } else if (method === 'NatCash' || method.toLowerCase() === 'natcash') {
                        customContent = (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: '#1e40af' }}>
                              <span className="text-[5px] font-bold text-white">NC</span>
                            </div>
                            <span className="text-[8px] font-bold text-center" style={{ color: '#1e40af' }}>NatCash</span>
                          </div>
                        );
                      } else {
                        const renderIcon = () => {
                          switch(display.icon) {
                            case 'bank':
                              return <Banknote className="w-4 h-4 mb-0.5" />;
                            case 'wallet':
                              return <Wallet className="w-4 h-4 mb-0.5" />;
                            case 'dollar':
                              return <DollarSign className="w-4 h-4 mb-0.5" />;
                            default:
                              return null;
                          }
                        };
                        customContent = (
                          <div className="flex flex-col items-center">
                            <div style={{ color: display.color }}>
                              {renderIcon()}
                            </div>
                            <span className="text-[8px] font-bold text-center" style={{ color: display.color }}>
                              {display.abbr}
                            </span>
                          </div>
                        );
                      }
                      
                      return (
                        <div 
                          key={method}
                          className="bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center hover:border-gray-300 transition"
                          title={display.label}
                        >
                          {customContent}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
          </div>
        )}
      </main>

      {/* Botones Fijos - Solo Mobile */}
      {items.length > 0 && isMobile && (
        <div className="fixed left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 bottom-10 z-40 flex justify-center">
          <div className="rounded-lg p-1 border border-gray-300 shadow-md w-full" style={{ backgroundColor: '#efefef' }}>
            <div className="flex gap-1 justify-between items-center">
              {/* Botón Compartir */}
              <button
                onClick={handleShareCart}
                disabled={isSharing}
                className="p-2 rounded-lg font-semibold text-sm transition flex items-center justify-center border border-border bg-muted hover:bg-muted/80"
                title="Compartir carrito"
              >
                {isSharing ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Share2 className="w-5 h-5 text-foreground" />}
              </button>

              <div className="flex-1" />

              {/* Total Badge */}
              <Badge
                variant="outline"
                className="text-sm border-2 px-3 py-1.5 rounded-lg"
                style={{ borderColor: '#29892a', color: '#29892a' }}
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                ${totalPrice.toFixed(2)}
              </Badge>

              {/* Botón Vaciar */}
              <button
                onClick={handleClearCart}
                className="p-2 rounded-lg transition hover:bg-red-100 border border-gray-300 text-red-600"
                title="Vaciar carrito"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Botón Comprar */}
              {someSelected ? (
                <Link
                  to="/checkout"
                  className="px-4 py-2 rounded-lg font-semibold text-sm transition shadow-lg hover:opacity-90 flex items-center justify-center gap-1.5 text-white"
                  style={{ backgroundColor: '#071d7f' }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Comprar ({totalQuantity})
                </Link>
              ) : (
                <button
                  disabled
                  className="px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 text-white opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: '#071d7f' }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Selecciona
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isMobile && <Footer />}

      {/* Clear Cart Confirmation Dialog */}
      <AlertDialog open={showClearCartDialog} onOpenChange={setShowClearCartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vaciar carrito</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar todos los productos de tu carrito? Esta acción no se puede deshacer.
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

      {/* Share Cart Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Compartir carrito
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Comparte este enlace para que otra persona pueda ver y agregar estos productos a su carrito.
            </p>
            
            {/* Link */}
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareLink}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-muted truncate"
              />
              <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
                {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={handleShareWhatsApp} className="w-full gap-2" style={{ backgroundColor: '#29892a' }}>
                <MessageCircle className="w-4 h-4" />
                Enviar por WhatsApp
              </Button>
              <Button variant="outline" onClick={handleCopyShareLink} className="w-full gap-2">
                <Copy className="w-4 h-4" />
                {shareCopied ? 'Copiado!' : 'Copiar enlace'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">El enlace expira en 7 días</p>
          </div>
        </DialogContent>
      </Dialog>


      {selectedItemForVariants && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setSelectedItemForVariants(null)}
          />

          {/* Responsive Panel */}
          <aside
            onClick={(e) => e.stopPropagation()}
            className="fixed bg-background shadow-2xl flex flex-col z-[61]
                       bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl
                       md:top-0 md:bottom-auto md:left-auto md:right-0 md:rounded-none md:border-l md:w-[420px] md:h-screen md:max-h-screen"
          >
            {/* Header with dynamic preview image */}
            <div className="flex items-center gap-3 p-4 border-b flex-shrink-0">
              <div className="relative flex-shrink-0">
                {(activePreviewImage || selectedItemForVariants.image) ? (
                  <img
                    src={activePreviewImage || selectedItemForVariants.image!}
                    alt={selectedItemForVariants.name}
                    className="w-16 h-16 rounded-xl object-cover border border-border/50 shadow-sm transition-all duration-300"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                    <Package className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold leading-tight line-clamp-2">{selectedItemForVariants.name}</h3>
                {matchingVariant && (
                  <p className="text-sm font-semibold text-primary mt-0.5">
                    ${matchingVariant.price.toFixed(2)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedItemForVariants(null)}
                className="p-1.5 hover:bg-muted rounded-full transition flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Variant content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {isLoadingVariants ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : catalogVariants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay variantes disponibles
                </p>
              ) : (
                <>
                  {/* ── B2B-style attribute selectors ───────────────────── */}
                  {drawerAttrTypes.map((type) => {
                    const config = ATTR_CONFIG[type] || { icon: Package, displayName: type, order: 99 };
                    const Icon = config.icon;
                    const options = drawerAttrOptions[type] || [];
                    const selected = selectedAttrs[type];

                    return (
                      <div key={type} className="p-3 bg-muted/30 rounded-xl border border-border/50">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          {config.displayName}
                          <Badge variant="secondary" className="text-[10px]">
                            {options.length} opciones
                          </Badge>
                        </h4>

                        {type === 'color' ? (
                          /* Color swatches with images */
                          <div className="flex flex-wrap gap-2.5">
                            {options.map(value => {
                              const isSelected = selected === value;
                              const img = drawerImageMap[type]?.[value];
                              const variantForOpt = catalogVariants.find(v => v.color === value);
                              const outOfStock = variantForOpt ? variantForOpt.stock === 0 : false;

                              return (
                                <button
                                  key={value}
                                  onClick={() => {
                                    setSelectedAttrs(prev => ({ ...prev, [type]: value }));
                                    if (img) setActivePreviewImage(img);
                                  }}
                                  disabled={outOfStock}
                                  className={cn(
                                    "relative w-14 h-14 rounded-xl border-2 transition-all overflow-hidden group",
                                    isSelected
                                      ? "border-primary ring-2 ring-primary/30 scale-105 shadow-md"
                                      : "border-border hover:border-primary/60 hover:scale-102",
                                    outOfStock && "opacity-30 cursor-not-allowed"
                                  )}
                                  title={`${value}${outOfStock ? ' - Sin stock' : ''}`}
                                >
                                  {img && (
                                    <img src={img} alt={value} className="w-full h-full object-cover" loading="lazy" />
                                  )}
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                                      <Check className="w-5 h-5 text-primary drop-shadow" />
                                    </div>
                                  )}
                                  {outOfStock && (
                                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                      <div className="w-7 h-0.5 bg-destructive rotate-45 rounded" />
                                    </div>
                                  )}
                                  <div className="absolute inset-x-0 -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <span className="text-[9px] text-muted-foreground capitalize truncate block text-center px-1">{value}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          /* Size / other attribute pill buttons */
                          <div className="flex flex-wrap gap-2">
                            {options.map(value => {
                              const isSelected = selected === value;
                              const variantForOpt = catalogVariants.find(v =>
                                (type === 'size' || type === 'talla') ? v.size === value : v.variantAttributes?.[type] === value
                              );
                              const outOfStock = variantForOpt ? variantForOpt.stock === 0 : false;

                              return (
                                <button
                                  key={value}
                                  onClick={() => setSelectedAttrs(prev => ({ ...prev, [type]: value }))}
                                  disabled={outOfStock}
                                  className={cn(
                                    "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium min-w-[44px]",
                                    isSelected
                                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                                      : "border-border bg-background hover:border-primary/60",
                                    outOfStock && "opacity-30 cursor-not-allowed line-through"
                                  )}
                                  title={`${value}${outOfStock ? ' - Sin stock' : ''}`}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Quantity + stock for matching variant ──────────── */}
                  {matchingVariant && (
                    <div className={cn(
                      "p-4 rounded-xl border-2 transition-all",
                      variantQtys[matchingVariant.id] > 0
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/20"
                    )}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {[matchingVariant.color, matchingVariant.size].filter(Boolean).join(' / ') || matchingVariant.sku}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-base font-bold text-primary">
                              ${matchingVariant.price.toFixed(2)}
                            </span>
                            <Badge
                              variant={matchingVariant.stock > 0 ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >
                              {matchingVariant.stock > 0 ? `${matchingVariant.stock} disp.` : 'Sin stock'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition disabled:opacity-40"
                            onClick={() => setVariantQtys(prev => ({
                              ...prev,
                              [matchingVariant.id]: Math.max(0, (prev[matchingVariant.id] ?? 0) - 1)
                            }))}
                            disabled={(variantQtys[matchingVariant.id] ?? 0) <= 0}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-sm font-bold w-8 text-center">
                            {variantQtys[matchingVariant.id] ?? 0}
                          </span>
                          <button
                            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition disabled:opacity-40"
                            onClick={() => setVariantQtys(prev => ({
                              ...prev,
                              [matchingVariant.id]: Math.min(matchingVariant.stock, (prev[matchingVariant.id] ?? 0) + 1)
                            }))}
                            disabled={(variantQtys[matchingVariant.id] ?? 0) >= matchingVariant.stock || matchingVariant.stock === 0}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!matchingVariant && drawerAttrTypes.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Selecciona todas las opciones para ver disponibilidad
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex-shrink-0 space-y-2">
              {matchingVariant && (variantQtys[matchingVariant.id] ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm font-medium text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">
                  <span>Total seleccionado</span>
                  <span className="text-primary font-bold">
                    ${(matchingVariant.price * (variantQtys[matchingVariant.id] ?? 0)).toFixed(2)}
                  </span>
                </div>
              )}
              <button
                onClick={handleAddVariantsToCart}
                disabled={isAddingVariant || !matchingVariant || (variantQtys[matchingVariant?.id ?? ''] ?? 0) === 0}
                className="w-full py-3 rounded-xl font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-40"
              >
                {isAddingVariant ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                Agregar al carrito
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default CartPage;

