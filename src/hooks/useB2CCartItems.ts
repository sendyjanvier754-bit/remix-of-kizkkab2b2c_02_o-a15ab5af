import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCartSync } from '@/hooks/useCartSync';

export interface StorePaymentInfo {
  bank_info?: {
    bank_name?: string;
    account_type?: string;
    account_number?: string;
    account_holder?: string;
  };
  moncash_info?: {
    phone_number?: string;
    name?: string;
  };
  natcash_info?: {
    phone_number?: string;
    name?: string;
  };
}

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
  storeMetadata?: StorePaymentInfo | null;
  // Variant fields
  variantId?: string | null;
  color?: string | null;
  size?: string | null;
  variantAttributes?: Record<string, any> | null;
}

export const useB2CCartItems = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<B2CCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialLoadedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  const loadCartItems = useCallback(async (showLoading = false) => {
    if (!user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      setError(null);

      // Get latest open cart (legacy data may contain multiple open carts)
      const { data: openCart, error: cartError } = await supabase
        .from('b2c_carts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cartError) {
        console.error('Error fetching open cart:', cartError);
        throw cartError;
      }

      if (!openCart?.id) {
        setItems([]);
        return;
      }

      const { data: cartItems, error: itemsError } = await supabase
        .from('b2c_cart_items')
        .select('*, store:store_id(metadata)')
        .eq('cart_id', openCart.id)
        .order('created_at', { ascending: false });

      if (itemsError) {
        console.error('Error fetching cart items:', itemsError);
        throw itemsError;
      }

      // Fetch seller prices separately to avoid PostgREST FK join dependency
      const variantIds = (cartItems || []).map(i => i.variant_id).filter(Boolean);
      const catalogIds = (cartItems || []).map(i => i.seller_catalog_id).filter(Boolean);

      const [variantPricesResult, catalogPricesResult] = await Promise.all([
        variantIds.length > 0
          ? supabase.from('seller_catalog_variants').select('id, precio_override').in('id', variantIds)
          : Promise.resolve({ data: [] as { id: string; precio_override: number | null }[], error: null }),
        catalogIds.length > 0
          ? supabase.from('seller_catalog').select('id, precio_venta').in('id', catalogIds)
          : Promise.resolve({ data: [] as { id: string; precio_venta: number | null }[], error: null }),
      ]);

      const variantPriceMap = new Map<string, number | null>(
        (variantPricesResult.data || []).map(v => [v.id, v.precio_override])
      );
      const catalogPriceMap = new Map<string, number | null>(
        (catalogPricesResult.data || []).map(c => [c.id, c.precio_venta])
      );

      // Collect items whose stored price differs from the seller's current price so we can
      // sync them back to the DB in the background (no await — fire-and-forget).
      const priceUpdates: Promise<any>[] = [];

      const formattedItems: B2CCartItem[] = (cartItems || []).map(item => {
        // Handle store metadata - may be object or array depending on query result
        let metadata: StorePaymentInfo | null = null;
        if (item.store) {
          if (Array.isArray(item.store) && item.store[0]?.metadata) {
            metadata = item.store[0].metadata as StorePaymentInfo;
          } else if (typeof item.store === 'object' && 'metadata' in item.store) {
            metadata = (item.store as any).metadata as StorePaymentInfo;
          }
        }

        // Resolve the seller's current price: variant-level override > catalog-level price > stored price
        const catalogVariantPrice = item.variant_id ? variantPriceMap.get(item.variant_id) : undefined;
        const catalogEntryPrice = item.seller_catalog_id ? catalogPriceMap.get(item.seller_catalog_id) : undefined;
        const currentSellerPrice: number =
          catalogVariantPrice != null ? Number(catalogVariantPrice) :
          catalogEntryPrice != null ? Number(catalogEntryPrice) :
          item.unit_price;

        // If the seller changed the price, sync the cart row silently
        if (Math.abs(currentSellerPrice - item.unit_price) > 0.001) {
          priceUpdates.push(
            Promise.resolve(
              supabase
                .from('b2c_cart_items')
                .update({
                  unit_price: currentSellerPrice,
                  total_price: currentSellerPrice * item.quantity,
                })
                .eq('id', item.id)
            ).then(() => {})
          );
        }

        return {
          id: item.id,
          sellerCatalogId: item.seller_catalog_id,
          sku: item.sku,
          name: item.nombre,
          price: currentSellerPrice,
          quantity: item.quantity,
          totalPrice: currentSellerPrice * item.quantity,
          image: item.image,
          storeId: item.store_id,
          storeName: item.store_name,
          storeWhatsapp: item.store_whatsapp,
          storeMetadata: metadata,
          // Variant fields
          variantId: item.variant_id || null,
          color: item.color || (item.variant_attributes as any)?.color || null,
          size: item.size || (item.variant_attributes as any)?.size || (item.variant_attributes as any)?.talla || null,
          variantAttributes: item.variant_attributes as Record<string, any> | null,
        };
      });

      // Fire-and-forget background price sync
      if (priceUpdates.length > 0) {
        Promise.all(priceUpdates).catch(err =>
          console.warn('Background price sync failed:', err)
        );
      }

      setItems(formattedItems);
    } catch (err) {
      console.error('Error loading cart items:', err);
      setError(err instanceof Error ? err.message : 'Error loading cart');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load items on mount and when user changes
  useEffect(() => {
    if (user?.id && !hasInitialLoadedRef.current) {
      hasInitialLoadedRef.current = true;
      loadCartItems(true); // Show loading on initial load
    }
  }, [user?.id, loadCartItems]);

  // Subscribe to cross-tab cart changes
  const { broadcastCartUpdate } = useCartSync(() => {
    loadCartItems(false);
  });

  // Subscribe to real-time changes using Supabase
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to changes in b2c_cart_items
    const itemsSubscription = supabase
      .channel(`b2c_cart_items:user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'b2c_cart_items',
        },
        () => {
          // Reload cart items on any change
          loadCartItems(false);
          // Broadcast to other tabs
          broadcastCartUpdate('b2c');
        }
      )
      .subscribe();

    // Also subscribe to changes in b2c_carts (for status changes like completed)
    const cartsSubscription = supabase
      .channel(`b2c_carts:user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'b2c_carts',
        },
        () => {
          // Reload cart items when cart status changes
          loadCartItems(false);
          // Broadcast to other tabs
          broadcastCartUpdate('b2c');
        }
      )
      .subscribe();

    subscriptionRef.current = itemsSubscription;

    return () => {
      if (itemsSubscription) {
        supabase.removeChannel(itemsSubscription);
      }
      if (cartsSubscription) {
        supabase.removeChannel(cartsSubscription);
      }
    };
  }, [user?.id, loadCartItems, broadcastCartUpdate]);

  return { items, isLoading, error, refetch: loadCartItems };
};
