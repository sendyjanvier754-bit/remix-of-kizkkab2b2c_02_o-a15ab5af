import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useB2CCartSupabase } from '@/hooks/useB2CCartSupabase';
import { useB2BCartSupabase } from '@/hooks/useB2BCartSupabase';
import { UserRole } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useCartMigration = () => {
  const { user, role } = useAuth();
  const localCart = useCart();
  const b2cCart = useB2CCartSupabase();
  const b2bCart = useB2BCartSupabase();
  const hasMigratedRef = useRef(false);

  useEffect(() => {
    const migrateCart = async () => {
      // Only migrate if user is logged in and we haven't migrated in this session yet
      // and there are items in the local cart
      if (!user || hasMigratedRef.current || localCart.items.length === 0) {
        return;
      }

      console.log("Starting cart migration for role:", role);
      hasMigratedRef.current = true;
      const itemsToMigrate = [...localCart.items];
      let migratedCount = 0;
      let adjustedCount = 0;

      try {
        if (role === UserRole.SELLER) {
          // Migration to B2B Cart
          for (const item of itemsToMigrate) {
            // Fetch B2B details from vista with market margins
            const { data: productData } = await supabase
              .from('v_productos_con_precio_b2b')
              .select('id, sku_interno, nombre, precio_b2b, moq, stock_fisico, imagen_principal')
              .eq('id', item.id)
              .maybeSingle();

            if (productData) {
              const moq = productData.moq || 1;
              const quantity = Math.max(item.quantity, moq);
              
              if (quantity > item.quantity) {
                adjustedCount++;
              }

              // Add to B2B Cart (DB)
              // Note: useB2BCartSupabase might not have a direct 'addItem' that works without cart ID initialization
              // We might need to call the Supabase insert directly or ensure the hook is ready.
              // For now, we'll assume we can use the hook's methods if exposed, or direct DB calls.
              // Since the hook exposes state, we might need to use direct DB calls here for reliability during migration.
              
              // Ensure cart exists
              let cartId = b2bCart.cart.id;
              if (!cartId) {
                 const { data: newCart } = await supabase
                  .from('b2b_carts')
                  .insert({ buyer_user_id: user.id, status: 'open' })
                  .select('id')
                  .single();
                 if (newCart) cartId = newCart.id;
              }

              if (cartId) {
                await supabase.from('b2b_cart_items').upsert({
                  cart_id: cartId,
                  product_id: productData.id,
                  sku: productData.sku_interno,
                  nombre: productData.nombre,
                  unit_price: productData.precio_b2b, // ← Precio con márgenes
                  quantity: quantity,
                  total_price: quantity * productData.precio_b2b,
                  moq: moq,
                  stock_disponible: productData.stock_fisico
                }, { onConflict: 'cart_id, product_id' });
                
                migratedCount++;
              }
            }
          }

          if (migratedCount > 0) {
            toast.success(`Se migraron ${migratedCount} productos a tu carrito mayorista.`);
            if (adjustedCount > 0) {
              toast.info(`${adjustedCount} productos fueron ajustados al MOQ (Mínimo de compra).`);
            }
            localCart.clearCart();
            // Refresh B2B cart
            // b2bCart.fetchOrCreateCart(); // If exposed
            window.location.reload(); // Simple way to refresh all states for now
          }

        } else if (role === UserRole.USER) {
          // Migration to B2C Cart
          let cartId = b2cCart.cart.id;
          if (!cartId) {
             const { data: newCart } = await supabase
              .from('b2c_carts')
              .insert({ user_id: user.id, status: 'open' })
              .select('id')
              .single();
             if (newCart) cartId = newCart.id;
          }

          if (cartId) {
            for (const item of itemsToMigrate) {
              await supabase.from('b2c_cart_items').upsert({
                cart_id: cartId,
                sku: item.sku,
                nombre: item.name,
                unit_price: item.price,
                quantity: item.quantity,
                total_price: item.price * item.quantity,
                image: item.image,
                store_id: item.storeId,
                store_name: item.storeName,
                store_whatsapp: item.storeWhatsapp
              }, { onConflict: 'cart_id, sku' }); // Assuming sku is unique per cart or we use a different constraint
              migratedCount++;
            }
          }

          if (migratedCount > 0) {
            toast.success(`Se migraron ${migratedCount} productos a tu carrito.`);
            localCart.clearCart();
            window.location.reload();
          }
        }
      } catch (error) {
        console.error("Error migrating cart:", error);
        toast.error("Hubo un problema migrando tu carrito.");
      }
    };

    migrateCart();
  }, [user, role]); // Run when user/role changes
};
