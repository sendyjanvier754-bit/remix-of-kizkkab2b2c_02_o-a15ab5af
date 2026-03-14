import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface B2CCartItem {
  id: string;
  sellerCatalogId: string | null;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
  image: string | null;
  storeId: string | null;
  storeName: string | null;
  storeWhatsapp: string | null;
}

export interface B2CCart {
  id: string | null;
  items: B2CCartItem[];
  totalItems: number;
  totalQuantity: number;
  totalPrice: number;
  status: 'open' | 'completed' | 'cancelled';
}

const initialCart: B2CCart = {
  id: null,
  items: [],
  totalItems: 0,
  totalQuantity: 0,
  totalPrice: 0,
  status: 'open',
};

export const useB2CCartSupabase = () => {
  const { user } = useAuth();
  const [cart, setCart] = useState<B2CCart>(initialCart);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch or create cart
  const fetchOrCreateCart = useCallback(async (userId: string) => {
    try {
      
      // Try to get latest open cart (legacy data may contain multiple open carts)
      const { data: existingCarts, error: fetchError } = await supabase
        .from('b2c_carts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching cart:', fetchError);
        throw fetchError;
      }

      let cartId: string;

      if (!existingCarts || existingCarts.length === 0) {
        // No cart exists, create one

        const { data: newCart, error: createError } = await supabase
          .from('b2c_carts')
          .insert([
            {
              user_id: userId,
              status: 'open',
            },
          ])
          .select()
          .single();

        if (createError) {
          console.error('Error creating cart:', createError);
          throw createError;
        }

        cartId = newCart.id;
      } else {
        cartId = existingCarts[0].id;
      }

      // Fetch cart items
      const { data: items, error: itemsError } = await supabase
        .from('b2c_cart_items')
        .select('*')
        .eq('cart_id', cartId);

      if (itemsError) {
        throw itemsError;
      }

      const formattedItems: B2CCartItem[] = (items || []).map(item => ({
        id: item.id,
        sellerCatalogId: item.seller_catalog_id,
        sku: item.sku,
        name: item.nombre,
        price: item.unit_price,
        quantity: item.quantity,
        totalPrice: item.total_price,
        image: item.image,
        storeId: item.store_id,
        storeName: item.store_name,
        storeWhatsapp: item.store_whatsapp,
      }));

      const totalPrice = formattedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalQuantity = formattedItems.reduce((sum, item) => sum + item.quantity, 0);

      setCart({
        id: cartId,
        items: formattedItems,
        totalItems: formattedItems.length,
        totalQuantity,
        totalPrice,
        status: 'open',
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching or creating cart:', error);
      setIsLoading(false);
      throw error;
    }
  }, []);

  // Initialize cart when user logs in
  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      fetchOrCreateCart(user.id)
        .then(() => {})
        .catch(err => {
          console.error('Error in fetchOrCreateCart:', err);
          setIsLoading(false);
        });
    } else {
      setCart(initialCart);
      setIsLoading(false);
    }
  }, [user?.id, fetchOrCreateCart]);

  // Add item to cart
  const addItem = useCallback(async (item: {
    sku: string;
    name: string;
    price: number;
    image?: string | null;
    storeId?: string | null;
    storeName?: string | null;
    storeWhatsapp?: string | null;
  }) => {
    if (!user?.id) {
      toast.error('Debes estar autenticado para agregar items al carrito');
      return;
    }

    if (!cart.id) {
      toast.error('Carrito no disponible. Por favor recarga la página.');
      return;
    }

    try {
      // Check if item already exists
      const existingItem = cart.items.find(i => i.sku === item.sku);

      if (existingItem) {
        // Update quantity
        const { error } = await supabase
          .from('b2c_cart_items')
          .update({
            quantity: existingItem.quantity + 1,
          })
          .eq('id', existingItem.id);

        if (error) throw error;

        // Update local state
        setCart(prev => ({
          ...prev,
          items: prev.items.map(i =>
            i.id === existingItem.id
              ? {
                  ...i,
                  quantity: i.quantity + 1,
                  totalPrice: item.price * (i.quantity + 1),
                }
              : i
          ),
          totalQuantity: prev.totalQuantity + 1,
          totalPrice: prev.totalPrice + item.price,
        }));
        
        toast.success('Producto agregado al carrito');
      } else {
        // Insert new item
        const totalPrice = item.price * 1;
        console.log('Inserting item:', {
          cart_id: cart.id,
          sku: item.sku,
          nombre: item.name,
          unit_price: item.price,
          total_price: totalPrice,
          quantity: 1,
        });

        // First insert without select
        const { error: insertError } = await supabase
          .from('b2c_cart_items')
          .insert([{
            cart_id: cart.id,
            sku: item.sku,
            nombre: item.name,
            unit_price: item.price,
            total_price: totalPrice,
            quantity: 1,
            image: item.image || null,
            store_id: item.storeId || null,
            store_name: item.storeName || null,
            store_whatsapp: item.storeWhatsapp || null,
          }]);

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }

        // Now fetch the item we just created
        const { data: newItem, error: fetchError } = await supabase
          .from('b2c_cart_items')
          .select('*')
          .eq('sku', item.sku)
          .eq('cart_id', cart.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError) {
          console.error('Fetch error:', fetchError);
          throw fetchError;
        }

        if (!newItem) {
          console.error('No data returned from fetch');
          throw new Error('No data returned from fetch');
        }

        console.log('Item inserted successfully:', newItem);

        const cartItem: B2CCartItem = {
          id: newItem.id,
          sellerCatalogId: newItem.seller_catalog_id,
          sku: newItem.sku,
          name: newItem.nombre,
          price: newItem.unit_price,
          quantity: 1,
          totalPrice: newItem.total_price,
          image: newItem.image,
          storeId: newItem.store_id,
          storeName: newItem.store_name,
          storeWhatsapp: newItem.store_whatsapp,
        };

        // Update local state
        setCart(prev => ({
          ...prev,
          items: [...prev.items, cartItem],
          totalItems: prev.totalItems + 1,
          totalQuantity: prev.totalQuantity + 1,
          totalPrice: prev.totalPrice + item.price,
        }));
        
        // Refetch all items to sync across components
        const { data: allItems, error: refetchError } = await supabase
          .from('b2c_cart_items')
          .select('*')
          .eq('cart_id', cart.id);

        if (!refetchError && allItems) {
          const formattedItems: B2CCartItem[] = allItems.map(item => ({
            id: item.id,
            sellerCatalogId: item.seller_catalog_id,
            sku: item.sku,
            name: item.nombre,
            price: item.unit_price,
            quantity: item.quantity,
            totalPrice: item.total_price,
            image: item.image,
            storeId: item.store_id,
            storeName: item.store_name,
            storeWhatsapp: item.store_whatsapp,
          }));

          const totalPrice = formattedItems.reduce((sum, i) => sum + i.totalPrice, 0);
          const totalQuantity = formattedItems.reduce((sum, i) => sum + i.quantity, 0);

          setCart(prev => ({
            ...prev,
            items: formattedItems,
            totalItems: formattedItems.length,
            totalQuantity,
            totalPrice,
          }));
        }
        
        toast.success('Producto agregado al carrito');
      }
    } catch (error) {
      console.error('Error adding item to cart:', error);
      toast.error('Error al agregar item al carrito');
    }
  }, [user?.id, cart.id, cart.items]);

  // Update item quantity
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from('b2c_cart_items')
        .update({ quantity })
        .eq('id', itemId);

      if (error) throw error;

      setCart(prev => {
        const item = prev.items.find(i => i.id === itemId);
        if (!item) return prev;

        const quantityDiff = quantity - item.quantity;
        return {
          ...prev,
          items: prev.items.map(i =>
            i.id === itemId
              ? {
                  ...i,
                  quantity,
                  totalPrice: i.price * quantity,
                }
              : i
          ),
          totalQuantity: prev.totalQuantity + quantityDiff,
          totalPrice: prev.totalPrice + quantityDiff * item.price,
        };
      });
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Error al actualizar cantidad');
    }
  }, []);

  // Remove item from cart
  const removeItem = useCallback(async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('b2c_cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setCart(prev => {
        const item = prev.items.find(i => i.id === itemId);
        if (!item) return prev;

        return {
          ...prev,
          items: prev.items.filter(i => i.id !== itemId),
          totalItems: prev.totalItems - 1,
          totalQuantity: prev.totalQuantity - item.quantity,
          totalPrice: prev.totalPrice - item.totalPrice,
        };
      });

      toast.success('Producto removido del carrito');
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Error al remover item');
    }
  }, []);

  // Clear cart
  const clearCart = useCallback(async () => {
    if (!cart.id) return;

    try {
      const { error } = await supabase
        .from('b2c_cart_items')
        .delete()
        .eq('cart_id', cart.id);

      if (error) throw error;

      setCart(prev => ({
        ...prev,
        items: [],
        totalItems: 0,
        totalQuantity: 0,
        totalPrice: 0,
      }));

      toast.success('Carrito vaciado');
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('Error al vaciar carrito');
    }
  }, [cart.id]);

  return {
    cart,
    items: cart.items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    isLoading,
  };
};
