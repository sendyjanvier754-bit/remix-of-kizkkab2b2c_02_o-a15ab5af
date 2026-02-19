import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
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
import { ShoppingCart, Trash2, Package, MessageCircle, CreditCard, Banknote, Wallet, DollarSign, CheckSquare, Square } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useB2CCartItems } from "@/hooks/useB2CCartItems";
import { useActiveB2COrder } from "@/hooks/useB2COrders";
import { B2CCartLockBanner } from "@/components/checkout/B2CCartLockBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { UserRole } from "@/types/auth";
import { supabase } from "@/integrations/supabase/client";
import { useCartSelectionStore } from "@/stores/useCartSelectionStore";
import { Checkbox } from "@/components/ui/checkbox";

const CartPage = () => {
  const navigate = useNavigate();
  const { items, isLoading, refetch } = useB2CCartItems();
  const { isCartLocked } = useActiveB2COrder();
  const isMobile = useIsMobile();
  const { user, role } = useAuth();
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [showClearCartDialog, setShowClearCartDialog] = useState(false);
  const [showRemoveItemDialog, setShowRemoveItemDialog] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);

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

  // Redirect sellers/admins to B2B cart
  const isB2BUser = role === UserRole.SELLER || role === UserRole.ADMIN;
  if (isB2BUser) {
    return <Navigate to="/seller/carrito" replace />;
  }

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

      toast.success('Producto eliminado del carrito');
      setShowRemoveItemDialog(false);
      setItemToRemove(null);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('No se pudo eliminar el producto');
    }
  };

  // Update item quantity
  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeItem(itemId);
      return;
    }

    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const newTotalPrice = item.price * quantity;

      const { error } = await supabase
        .from('b2c_cart_items')
        .update({
          quantity,
          total_price: newTotalPrice
        })
        .eq('id', itemId);

      if (error) throw error;
      await refetch(false);
      toast.success('Cantidad actualizada');
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('No se pudo actualizar la cantidad');
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
        toast.error('Usuario no identificado');
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
        toast.error('No se encontró un carrito abierto');
        return;
      }

      const { error: deleteError } = await supabase
        .from('b2c_cart_items')
        .delete()
        .eq('cart_id', cartData.id);

      if (deleteError) throw deleteError;

      await refetch(false);
      toast.success('Carrito vaciado');
      setShowClearCartDialog(false);
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('No se pudo vaciar el carrito');
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

  const handleNegotiate = (storeItems: typeof items) => {
    const storeName = storeItems[0]?.storeName || 'Vendedor';
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
              <h1 className="font-bold text-sm">Mi Carrito</h1>
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
        {items.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-2">Tu carrito está vacío</p>
            <p className="text-xs text-gray-500 mb-4">Explora el catálogo para encontrar productos</p>
            <Button asChild style={{ backgroundColor: '#071d7f' }} className="text-white hover:opacity-90">
              <Link to="/">Ir al Catálogo</Link>
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
                        title={`Contactar a ${storeName}`}
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
                          {/* Product Image */}
                          <div className="flex-shrink-0 rounded-md bg-muted overflow-hidden" style={{ width: '70px', height: '70px' }}>
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
                          </div>
                          
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
                            
                            {/* Variant badges and Quantity Info */}
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
                              <span className="text-xs text-gray-600">
                                Cant: {item.quantity}
                              </span>
                            </div>
                            
                            {/* Price */}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-sm font-bold" style={{ color: '#29892a' }}>
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                            
                            {/* Subtotal */}
                            <div className="flex items-center justify-end mt-2">
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
                      <h2 className="font-bold text-lg text-gray-900">Mi Carrito</h2>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-semibold">
                        {items.length} productos
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {selectedItems.length} de {items.length} seleccionados
                      </span>
                      <button
                        onClick={handleClearCart}
                        className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1.5 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        Vaciar
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
                              title={`Contactar a ${storeName}`}
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

                              {/* Product Image */}
                              <div 
                                onClick={() => navigate(`/producto/${item.sku}`)}
                                className="flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition w-24 h-24"
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
                              </div>

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <p 
                                    onClick={() => navigate(`/producto/${item.sku}`)}
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
                                    title="Eliminar del carrito"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Variant badges and Quantity Info */}
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
                                  <span className="text-xs text-gray-600">
                                    Cant: {item.quantity}
                                  </span>
                                </div>

                                {/* Price and Controls Row */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <span className="text-lg font-bold" style={{ color: '#29892a' }}>
                                      ${item.price.toFixed(2)}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      x{item.quantity}
                                    </span>
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
                  <h2 className="font-bold text-base text-gray-900">Resumen del Pedido</h2>
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
                    <span className="text-gray-600">Precio Retail:</span>
                    <span className="font-semibold text-gray-900">${totalPrice.toFixed(2)}</span>
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
                    <span className="text-sm font-medium text-gray-700">Precio Estimado:</span>
                    <span className="text-lg font-bold" style={{ color: '#071d7f' }}>
                      ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Se confirma el precio final en confirmar pedido</p>
                </div>

                {/* Checkout Button and Support */}
                <div className="p-2 flex gap-2 justify-center">
                  <button
                    onClick={handleWhatsAppSupport}
                    className="px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-2 bg-transparent border border-gray-300"
                    style={{ color: '#29892a' }}
                    title="Contactar por WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" style={{ color: '#29892a' }} />
                    Soporte
                  </button>
                  {someSelected ? (
                    <Link
                      to="/checkout"
                      className="px-4 py-2 rounded-lg font-semibold text-xs text-white transition hover:opacity-90 flex items-center justify-center gap-2 shadow-lg"
                      style={{ backgroundColor: '#071d7f' }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Comprar ({totalQuantity})
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg font-semibold text-xs text-white flex items-center justify-center gap-2 shadow-lg opacity-50 cursor-not-allowed"
                      style={{ backgroundColor: '#071d7f' }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Selecciona productos
                    </button>
                  )}
                </div>

                {/* Payment Methods */}
                <div className="p-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Aceptamos:</p>
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
        )}
      </main>

      {/* Botones Fijos - Solo Mobile */}
      {items.length > 0 && isMobile && (
        <div className="fixed left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 bottom-10 z-40 flex justify-center">
          <div className="rounded-lg p-2 border border-gray-300 shadow-md w-full" style={{ backgroundColor: '#efefef' }}>
            <div className="flex gap-2 justify-between">
              {/* Botón WhatsApp Soporte */}
              <button
                onClick={handleWhatsAppSupport}
                className="px-3 py-2 rounded-lg font-semibold text-sm transition border border-gray-300 flex items-center justify-center gap-1.5 bg-transparent"
                style={{ color: '#29892a' }}
                title="Contactar por WhatsApp"
              >
                <MessageCircle className="w-4 h-4" style={{ color: '#29892a' }} />
                Soporte
              </button>

              {/* Botón Vaciar Carrito */}
              <button
                onClick={handleClearCart}
                className="px-3 py-2 rounded-lg font-semibold text-sm transition hover:bg-red-200 border border-gray-300 flex items-center justify-center gap-1.5 text-red-600"
                title="Vaciar carrito"
              >
                <Trash2 className="w-4 h-4" />
                Vaciar
              </button>

              {/* Botón Comprar */}
              <Link
                to="/checkout"
                className="px-4 py-2 rounded-lg font-semibold text-sm transition shadow-lg hover:opacity-90 flex items-center justify-center gap-1.5 text-white"
                style={{ backgroundColor: '#071d7f' }}
              >
                <ShoppingCart className="w-4 h-4" />
                Comprar ({totalQuantity})
              </Link>
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
    </div>
  );
};

export default CartPage;
