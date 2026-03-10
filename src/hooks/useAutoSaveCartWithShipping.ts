import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Hook: useAutoSaveCartWithShipping
// ============================================================================
// 
// MEJORAS SOBRE useB2BCartSupabase:
// ✅ Auto-guarda cambios después de 500ms (debounce)
// ✅ Optimistic UI updates (UI instantánea)
// ✅ Calcula shipping desde DB usando get_user_cart_shipping_cost
// ✅ 100% seguro - todo desde DB
// ✅ Recibe tier_id seleccionado
// ✅ No requiere botón "Guardar"
// ============================================================================

interface ShippingCost {
  total_items: number;
  total_weight_kg: number;
  weight_rounded_kg: number;
  base_cost: number;
  oversize_surcharge: number;
  dimensional_surcharge: number;
  extra_cost: number;
  total_cost_with_type: number;
  shipping_type_name: string;
  shipping_type_display: string;
  volume_m3: number;
}

export function useAutoSaveCartWithShipping(
  selectedShippingTypeId: string | null,
  onItemsChange?: () => void | Promise<void> // ✅ Callback para refrescar items
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [cartId, setCartId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState<ShippingCost | null>(null);
  // TICKET #18: tier guardado en DB, para restaurar al recargar página
  const [savedShippingTypeId, setSavedShippingTypeId] = useState<string | null>(null);
  
  // Queue de updates pendientes
  const updateQueue = useRef<Record<string, number>>({});
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  // TICKET #18: evitar el UPDATE al cargar la primera vez (solo cuando el user cambia el tier)
  const isInitializedRef = useRef(false);

  // ============================================================================
  // PASO 1: Obtener o crear carrito (+ leer tier guardado)
  // ============================================================================
  
  useEffect(() => {
    async function initCart() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('b2b_carts')
          .select('id, selected_shipping_tier_id')
          .eq('buyer_user_id', user.id)
          .eq('status', 'open')
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setCartId(data.id);
          // TICKET #18: restaurar tier guardado
          if (data.selected_shipping_tier_id) {
            setSavedShippingTypeId(data.selected_shipping_tier_id);
          }
        } else {
          // Crear nuevo carrito
          const { data: newCart, error: createError } = await supabase
            .from('b2b_carts')
            .insert({ buyer_user_id: user.id, status: 'open' })
            .select('id, selected_shipping_tier_id')
            .single();

          if (createError) throw createError;
          setCartId(newCart.id);
        }
        isInitializedRef.current = true;
      } catch (err) {
        console.error('Error initializing cart:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initCart();
  }, [user?.id]);

  // ============================================================================
  // PASO 2: Calcular shipping desde DB (100% seguro)
  // ============================================================================
  
  const calculateShippingCost = useCallback(async () => {
    if (!user?.id || !selectedShippingTypeId) {
      setShippingCost(null);
      return;
    }

    setIsCalculatingShipping(true);

    try {
      const { data, error } = await (supabase.rpc as any)('get_user_cart_shipping_cost', {
        p_user_id: user.id,
        p_shipping_type_id: selectedShippingTypeId
      });

      if (error) {
        // Log error en backend - no mostrar al usuario
        console.error('Backend shipping calculation error:', error);
        throw error;
      }

      setShippingCost(data as unknown as ShippingCost);
    } catch (err) {
      // Solo log en consola - no mensaje visible al usuario
      console.error('Error calculating shipping:', err);
      setShippingCost(null);
    } finally {
      setIsCalculatingShipping(false);
    }
  }, [user?.id, selectedShippingTypeId]);

  // Recalcular cuando cambia el tier seleccionado
  useEffect(() => {
    if (cartId) {
      calculateShippingCost();
    }
  }, [cartId, calculateShippingCost]);

  // TICKET #18: persistir el tier seleccionado en b2b_carts cuando cambia
  useEffect(() => {
    if (!cartId || !isInitializedRef.current) return;
    // No persistir null → solo guardar cuando hay un tier real seleccionado
    if (!selectedShippingTypeId) return;

    supabase
      .from('b2b_carts')
      .update({ selected_shipping_tier_id: selectedShippingTypeId })
      .eq('id', cartId)
      .then(({ error }) => {
        if (error) {
          console.error('Error persisting selected tier:', error);
        }
      });
  }, [cartId, selectedShippingTypeId]);

  // ============================================================================
  // PASO 3: Guardar cambios en DB (debounced)
  // ============================================================================
  
  const processSaveQueue = useCallback(async () => {
    if (Object.keys(updateQueue.current).length === 0) return;

    setIsSaving(true);

    try {
      // Procesar todos los updates pendientes
      const updates = Object.entries(updateQueue.current);
      
      for (const [itemId, quantity] of updates) {
        if (quantity === 0) {
          // Eliminar item
          await supabase
            .from('b2b_cart_items')
            .delete()
            .eq('id', itemId);
        } else {
          // Actualizar cantidad
          const { data: item } = await supabase
            .from('b2b_cart_items')
            .select('unit_price')
            .eq('id', itemId)
            .single();

          if (item) {
            await supabase
              .from('b2b_cart_items')
              .update({
                quantity,
                total_price: quantity * item.unit_price
              })
              .eq('id', itemId);
          }
        }
      }

      // Limpiar queue
      updateQueue.current = {};

      // Refrescar items si hay callback
      if (onItemsChange) {
        await onItemsChange();
      }

      // Invalidar queries para refetch
      queryClient.invalidateQueries({ queryKey: ['cart-items'] });
      queryClient.invalidateQueries({ queryKey: ['cart-shipping-cost'] });
      queryClient.invalidateQueries({ queryKey: ['cart-shipping-cost-selected'] }); // ✅ Invalidar shipping cost view
      queryClient.invalidateQueries({ queryKey: ['b2b-cart-logistics'] }); // ✅ Invalidar logistics

      // Recalcular shipping desde DB
      await calculateShippingCost();

    } catch (err) {
      console.error('Error saving cart changes:', err);
      toast.error('Error guardando cambios en el carrito');
    } finally {
      setIsSaving(false);
    }
  }, [calculateShippingCost, queryClient, onItemsChange]);

  // ============================================================================
  // PASO 4: Update con optimistic UI + debounced save
  // ============================================================================
  
  const updateQuantity = useCallback((itemId: string, newQuantity: number) => {
    // 1. Optimistic UI - Actualizar cache inmediatamente
    queryClient.setQueryData(['cart-items'], (oldData: any) => {
      if (!oldData) return oldData;
      
      // Si es un array directo
      if (Array.isArray(oldData)) {
        return oldData.map((item: any) => {
          if (item.id === itemId) {
            const unitPrice = item.precioB2B || item.unit_price || 0;
            const newSubtotal = newQuantity * unitPrice;
            return { 
              ...item, 
              cantidad: newQuantity, 
              quantity: newQuantity,
              subtotal: newSubtotal,
              total_price: newSubtotal
            };
          }
          return item;
        });
      }
      
      // Si tiene estructura { data: [...] }
      if (oldData.data && Array.isArray(oldData.data)) {
        return {
          ...oldData,
          data: oldData.data.map((item: any) => {
            if (item.id === itemId) {
              const unitPrice = item.precioB2B || item.unit_price || 0;
              const newSubtotal = newQuantity * unitPrice;
              return { 
                ...item, 
                cantidad: newQuantity, 
                quantity: newQuantity,
                subtotal: newSubtotal,
                total_price: newSubtotal
              };
            }
            return item;
          })
        };
      }
      
      return oldData;
    });

    // 2. Actualizar queue para guardado
    updateQueue.current[itemId] = newQuantity;

    // 3. Cancelar timeout anterior
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    // 4. Programar guardado (500ms después del último cambio)
    saveTimeout.current = setTimeout(() => {
      processSaveQueue();
    }, 500);
  }, [processSaveQueue, queryClient]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, []);

  // ============================================================================
  // PASO 5: Forzar guardado (para checkout)
  // ============================================================================
  
  const forceSave = useCallback(async () => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    await processSaveQueue();
  }, [processSaveQueue]);

  return {
    cartId,
    isLoading,
    isSaving,
    isCalculatingShipping,
    shippingCost,
    // TICKET #18: tier guardado en DB para restaurar al init
    savedShippingTypeId,
    updateQuantity,
    forceSave,
    refetchShipping: calculateShippingCost
  };
}
