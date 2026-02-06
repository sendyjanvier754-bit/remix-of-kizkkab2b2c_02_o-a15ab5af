import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VariantInfo {
  variantId?: string;
  color?: string;
  size?: string;
  variantAttributes?: Record<string, any>;
}

interface B2CAddItemParams {
  userId: string;
  sku: string;
  name: string;
  price: number;
  quantity?: number;
  image?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  storeWhatsapp?: string | null;
  sellerCatalogId?: string | null;
  variant?: VariantInfo;
}

interface B2BAddItemParams {
  userId: string;
  productId?: string;
  sku: string;
  name: string;
  priceB2B: number;
  quantity: number;
  image?: string | null;
  variant?: VariantInfo;
}

/**
 * Add item directly to B2C cart in database
 */
export const addItemB2C = async (params: B2CAddItemParams) => {
  try {
    console.log('B2C: Getting or creating cart for user:', params.userId);
    
    // Get or create cart for user
    let { data: carts, error: cartError } = await supabase
      .from('b2c_carts')
      .select('id')
      .eq('user_id', params.userId)
      .eq('status', 'open')
      .limit(1)
      .order('created_at', { ascending: false });

    if (cartError) {
      console.error('Error fetching cart:', cartError);
      throw cartError;
    }

    let cart = carts && carts.length > 0 ? carts[0] : null;

    // If no cart exists, create one
    if (!cart) {
      console.log('B2C: No cart found, creating new one');
      
      const { data: newCart, error: createError } = await supabase
        .from('b2c_carts')
        .insert([{
          user_id: params.userId,
          status: 'open',
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating cart:', createError);
        throw createError;
      }
      
      console.log('B2C: Cart created successfully:', newCart.id);
      cart = newCart;
    } else {
      console.log('B2C: Cart found:', cart.id);
    }

    // Insert item with variant info
    console.log('B2C: Inserting item:', params.sku, 'with variant:', params.variant);
    
    const { error: insertError } = await supabase
      .from('b2c_cart_items')
      .insert([{
        cart_id: cart.id,
        seller_catalog_id: params.sellerCatalogId || null,
        sku: params.sku,
        nombre: params.name,
        unit_price: params.price,
        total_price: params.price * (params.quantity || 1),
        quantity: params.quantity || 1,
        image: params.image,
        store_id: params.storeId,
        store_name: params.storeName,
        store_whatsapp: params.storeWhatsapp,
        // Variant columns
        variant_id: params.variant?.variantId || null,
        color: params.variant?.color || null,
        size: params.variant?.size || null,
        variant_attributes: params.variant?.variantAttributes || null,
      }]);

    if (insertError) {
      console.error('Error inserting item:', insertError);
      throw insertError;
    }

    console.log('B2C: Item added successfully:', params.sku);
    return true;
  } catch (error) {
    console.error('Error adding item to B2C cart:', error);
    throw error;
  }
};

/**
 * Add item directly to B2B cart in database
 */
export const addItemB2B = async (params: B2BAddItemParams) => {
  try {
    console.log('B2B: Adding item for user:', params.userId);
    
    // Get or create cart for user
    let { data: carts, error: cartError } = await supabase
      .from('b2b_carts')
      .select('id')
      .eq('buyer_user_id', params.userId)
      .eq('status', 'open')
      .limit(1)
      .order('created_at', { ascending: false });

    if (cartError) {
      console.error('Error fetching cart:', cartError);
      throw cartError;
    }

    let cart = carts && carts.length > 0 ? carts[0] : null;

    // If no cart exists, create one
    if (!cart) {
      console.log('B2B: No cart found, creating new one for user:', params.userId);
      
      const { data: newCart, error: createError } = await supabase
        .from('b2b_carts')
        .insert([{
          buyer_user_id: params.userId,
          status: 'open',
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating cart:', createError);
        throw createError;
      }
      
      console.log('B2B: Cart created successfully:', newCart);
      cart = newCart;
    } else {
      console.log('B2B: Using existing cart:', cart.id);
    }

    // Insert/merge item
    console.log('B2B: Adding/merging item:', params.sku, 'to cart:', cart.id, 'with variant:', params.variant);
    
    // ✅ CRITICAL: Get price from correct vista (NO FALLBACK)
    let finalPrice = params.priceB2B;
    const variantId = params.variant?.variantId || null;
    
    if (variantId) {
      console.log('B2B: Fetching variant price from v_variantes_con_precio_b2b for variant:', variantId);
      const { data: variantData } = await (supabase as any)
        .from('v_variantes_con_precio_b2b')
        .select('precio_b2b_final, product_id')
        .eq('id', variantId)
        .single();
      
      if (variantData?.precio_b2b_final) {
        // ✅ Usar SOLO precio_b2b_final de variante (sin fallback al producto padre)
        finalPrice = variantData.precio_b2b_final;
        console.log('B2B: Using variant price from vista:', finalPrice);
      }
    }
    
    // If no productId provided, try to find it by SKU or variant
    let productId: string | undefined = params.productId;
    if (!productId && params.sku) {
      const skuBase = params.sku.split('-')[0];
      // B2B context: use v_productos_con_precio_b2b vista
      const { data: productData } = await (supabase as any)
        .from('v_productos_con_precio_b2b')
        .select('id')
        .eq('sku_interno', skuBase)
        .limit(1);
      
      if (productData?.[0]?.id) {
        productId = productData[0].id as string;
        console.log('B2B: Found productId by SKU:', productId);
      }
    }

    // Prefer merging by variant_id when present (source of truth)
    const existingQuery = supabase
      .from('b2b_cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id);

    if (variantId) {
      (existingQuery as any).eq('variant_id', variantId);
    } else {
      // Fallback merge for non-variant items
      if (productId) (existingQuery as any).eq('product_id', productId);
      (existingQuery as any).eq('sku', params.sku).is('variant_id', null);
    }

    const { data: existingItems, error: existingError } = await existingQuery;
    if (existingError) throw existingError;

    const basePayload = {
      sku: params.sku,
      nombre: params.name,
      unit_price: finalPrice, // Use price from vista if variant
      image: params.image || null,
      // Variant columns
      variant_id: variantId,
      color: params.variant?.color || null,
      size: params.variant?.size || null,
      variant_attributes: params.variant?.variantAttributes || null,
    };

    if (existingItems && existingItems.length > 0) {
      const primary = existingItems[0];
      const existingQty = existingItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
      const newQty = existingQty + params.quantity;

      const { error: updateError } = await supabase
        .from('b2b_cart_items')
        .update({
          ...basePayload,
          // Keep product_id stable (if we were able to resolve it)
          ...(productId ? { product_id: productId } : {}),
          quantity: newQty,
          total_price: finalPrice * newQty, // ✅ Use finalPrice from vista
        })
        .eq('id', primary.id);

      if (updateError) throw updateError;

      // Clean up duplicates if they exist
      const duplicateIds = existingItems.slice(1).map((it) => it.id);
      if (duplicateIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('b2b_cart_items')
          .delete()
          .in('id', duplicateIds);

        if (deleteError) {
          console.warn('B2B: Could not delete duplicate cart items:', deleteError);
        }
      }

      console.log('B2B: Item merged successfully:', { variantId, newQty, merged: existingItems.length });
      return true;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('b2b_cart_items')
      .insert([
        {
          cart_id: cart.id,
          product_id: productId || null,
          ...basePayload,
          total_price: finalPrice * params.quantity, // ✅ Use finalPrice from vista
          quantity: params.quantity,
        },
      ])
      .select();

    if (insertError) {
      console.error('Error inserting item:', insertError);
      throw insertError;
    }

    console.log('B2B: Item inserted successfully:', inserted);
    return true;
  } catch (error) {
    console.error('Error adding item to B2B cart:', error);
    throw error;
  }
};
