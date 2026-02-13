import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface B2BCartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  sku: string;
  nombre: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  color?: string;
  size?: string;
  moq: number;
  stockDisponible: number;
  imagen?: string;
}

export interface B2BCart {
  id: string | null;
  items: B2BCartItem[];
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  status: 'open' | 'completed' | 'cancelled';
}

const initialCart: B2BCart = {
  id: null,
  items: [],
  totalItems: 0,
  totalQuantity: 0,
  subtotal: 0,
  status: 'open',
};

export const useB2BCartSupabase = () => {
  const { user } = useAuth();
  const [cart, setCart] = useState<B2BCart>(initialCart);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch or create cart for user
  const fetchOrCreateCart = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      // Try to get existing open cart
      const { data: existingCart, error: fetchError } = await supabase
        .from('b2b_carts')
        .select('*')
        .eq('buyer_user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingCart) {
        // Fetch cart items
        const { data: items, error: itemsError } = await supabase
          .from('b2b_cart_items')
          .select('*')
          .eq('cart_id', existingCart.id);

        if (itemsError) throw itemsError;

        // Map items and get product MOQ/stock info
        const mappedItems: B2BCartItem[] = await Promise.all(
          (items || []).map(async (item) => {
            let moq = 1;
            let stockDisponible = 0;
            let imagen: string | undefined = undefined;
            
            if (item.product_id) {
              const { data: product } = await supabase
                .from('v_productos_con_precio_b2b')
                .select('moq, stock_fisico, imagen_principal, precio_b2b')
                .eq('id', item.product_id)
                .maybeSingle();
              
              if (product) {
                moq = product.moq || 1;
                stockDisponible = product.stock_fisico || 0;
                imagen = product.imagen_principal || undefined;
              }
            }

            return {
              id: item.id,
              productId: item.product_id || '',
              variantId: item.variant_id || null,
              sku: item.sku,
              nombre: item.nombre,
              unitPrice: Number(item.unit_price),
              quantity: item.quantity,
              totalPrice: Number(item.total_price),
              color: item.color || undefined,
              size: item.size || undefined,
              moq,
              stockDisponible,
              imagen,
            };
          })
        );

        setCart({
          id: existingCart.id,
          items: mappedItems,
          totalItems: mappedItems.length,
          totalQuantity: mappedItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: mappedItems.reduce((sum, item) => sum + item.totalPrice, 0),
          status: existingCart.status as 'open' | 'completed' | 'cancelled',
        });
      } else {
        // Create new cart
        const { data: newCart, error: createError } = await supabase
          .from('b2b_carts')
          .insert({ buyer_user_id: user.id, status: 'open' })
          .select()
          .single();

        if (createError) throw createError;

        setCart({
          ...initialCart,
          id: newCart.id,
        });
      }
    } catch (error) {
      console.error('Error fetching/creating cart:', error);
      toast.error('Error al cargar el carrito');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrCreateCart();
  }, [fetchOrCreateCart]);

  // Add item to cart
  const addItem = useCallback(async (item: {
    productId: string;
    variantId?: string | null;
    sku: string;
    nombre: string;
    unitPrice: number;
    quantity: number;
    color?: string;
    size?: string;
    moq: number;
    stockDisponible: number;
  }) => {
    if (!cart.id) {
      toast.error('Carrito no disponible');
      return;
    }

    // Validate MOQ
    if (item.quantity < item.moq) {
      toast.error(`La cantidad mínima de pedido es ${item.moq} unidades`);
      return;
    }

    // Validate stock
    if (item.quantity > item.stockDisponible) {
      toast.error(`Stock disponible: ${item.stockDisponible} unidades`);
      return;
    }

    try {
      // Check if item already exists in cart (match by product AND variant)
      const existingItem = cart.items.find(i => 
        i.productId === item.productId && 
        (i.variantId || null) === (item.variantId || null)
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + item.quantity;
        
        if (newQuantity > item.stockDisponible) {
          toast.error(`Stock máximo disponible: ${item.stockDisponible} unidades`);
          return;
        }

        const { error } = await supabase
          .from('b2b_cart_items')
          .update({
            quantity: newQuantity,
            total_price: newQuantity * item.unitPrice,
          })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        // Get weight for this specific product/variant
        const { data: weightData, error: weightError } = await supabase
          .rpc('get_product_weight', {
            p_product_id: item.productId,
            p_variant_id: item.variantId || null
          });

        if (weightError) {
          console.error('Error getting product weight:', weightError);
        }

        const peso_kg = weightData || 0;

        const { error } = await supabase
          .from('b2b_cart_items')
          .insert({
            cart_id: cart.id,
            product_id: item.productId,
            variant_id: item.variantId || null,
            sku: item.sku,
            nombre: item.nombre,
            unit_price: item.unitPrice,
            quantity: item.quantity,
            total_price: item.quantity * item.unitPrice,
            peso_kg: peso_kg,
            color: item.color || null,
            size: item.size || null,
          });

        if (error) throw error;
      }

      await fetchOrCreateCart();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Error al agregar producto');
    }
  }, [cart.id, cart.items, fetchOrCreateCart]);

  // Update item quantity
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const item = cart.items.find(i => i.id === itemId);
    if (!item) return;

    if (quantity < item.moq) {
      toast.error(`La cantidad mínima de pedido es ${item.moq} unidades`);
      return;
    }

    if (quantity > item.stockDisponible) {
      toast.error(`Stock disponible: ${item.stockDisponible} unidades`);
      return;
    }

    try {
      const { error } = await supabase
        .from('b2b_cart_items')
        .update({
          quantity,
          total_price: quantity * item.unitPrice,
        })
        .eq('id', itemId);

      if (error) throw error;

      await fetchOrCreateCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Error al actualizar cantidad');
    }
  }, [cart.items, fetchOrCreateCart]);

  // Remove item from cart
  const removeItem = useCallback(async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('b2b_cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await fetchOrCreateCart();
      toast.success('Producto eliminado del carrito');
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Error al eliminar producto');
    }
  }, [fetchOrCreateCart]);

  // Clear cart
  const clearCart = useCallback(async () => {
    if (!cart.id) return;

    try {
      const { error } = await supabase
        .from('b2b_cart_items')
        .delete()
        .eq('cart_id', cart.id);

      if (error) throw error;

      await fetchOrCreateCart();
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('Error al vaciar carrito');
    }
  }, [cart.id, fetchOrCreateCart]);

  // Create order from cart
  const createOrder = useCallback(async (
    paymentMethod: 'stripe' | 'moncash' | 'transfer',
    shippingAddress?: {
      id: string;
      full_name: string;
      phone?: string;
      street_address: string;
      city: string;
      state?: string;
      postal_code?: string;
      country: string;
      notes?: string;
    }
  ) => {
    if (!cart.id || !user?.id || cart.items.length === 0) {
      toast.error('Carrito vacío o usuario no autenticado');
      return null;
    }

    try {
      // Create order with shipping address in metadata
      const { data: order, error: orderError } = await supabase
        .from('orders_b2b')
        .insert({
          seller_id: user.id,
          total_amount: cart.subtotal,
          total_quantity: cart.totalQuantity,
          payment_method: paymentMethod,
          status: 'draft',
          currency: 'USD',
          metadata: shippingAddress ? { shipping_address: shippingAddress } : null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        sku: item.sku,
        nombre: item.nombre,
        cantidad: item.quantity,
        precio_unitario: item.unitPrice,
        subtotal: item.totalPrice,
      }));

      const { error: itemsError } = await supabase
        .from('order_items_b2b')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Mark cart as completed
      const { error: cartError } = await supabase
        .from('b2b_carts')
        .update({ status: 'completed' })
        .eq('id', cart.id);

      if (cartError) throw cartError;

      // Reset local cart state
      setCart(initialCart);

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error al crear pedido');
      return null;
    }
  }, [cart, user?.id]);

  // Mark order as paid (triggers the post-payment function)
  const markOrderAsPaid = useCallback(async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders_b2b')
        .update({ status: 'paid' })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Pago confirmado. Los productos se agregarán a tu catálogo.');
      return true;
    } catch (error) {
      console.error('Error marking order as paid:', error);
      toast.error('Error al confirmar pago');
      return false;
    }
  }, []);

  return {
    cart,
    isLoading,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    createOrder,
    markOrderAsPaid,
    refetch: fetchOrCreateCart,
  };
};
