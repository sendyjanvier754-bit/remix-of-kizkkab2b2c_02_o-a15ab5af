import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para invalidar automáticamente las queries de TanStack Query
 * cuando los shipping_tiers cambian en la base de datos.
 * 
 * Esto asegura que el carrito, checkout y selectores de envío
 * se actualicen automáticamente cuando el admin cambie costos de tramos.
 * 
 * FLUJO:
 * 1. Admin cambia costo en route_logistics_costs
 * 2. Trigger SQL actualiza shipping_tiers automáticamente
 * 3. Este hook recibe notificación via Realtime
 * 4. Invalida queries de TanStack Query
 * 5. Frontend se refresca automáticamente
 */
export function useShippingTiersRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Create realtime channel
    const channel = supabase
      .channel('shipping_tiers_realtime_sync')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'shipping_tiers',
        },
        (payload) => {
          // Invalidar todas las queries relacionadas con shipping
          const queriesToInvalidate = [
            // Hooks de shipping types
            ['shipping-tiers'],
            ['shipping_tiers_all'],
            ['shipping-tier-details'],
            
            // Hooks de costos de carrito
            ['cart-shipping-cost'],
            ['cart-shipping-cost-logistics'],
            ['cart-shipping-cost-view'],
            
            // Hooks de logística
            ['b2b-cart-logistics'],
            ['shipping-cost-calculation'],
            
            // Admin panel
            ['logistics-costs'],
            ['route-costs'],
          ];

          queriesToInvalidate.forEach(queryKey => {
            queryClient.invalidateQueries({ queryKey });
          });
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null; // Este hook solo hace side effects
}

/**
 * Componente wrapper para usar en _app.tsx o layout raíz
 * para que la sincronización esté activa en toda la app
 */
export function ShippingTiersRealtimeProvider() {
  useShippingTiersRealtimeSync();
  return null;
}
