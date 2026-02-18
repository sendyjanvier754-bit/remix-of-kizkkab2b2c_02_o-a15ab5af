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
  const [error, setError] = useState<string | null>(null);
  
  // Queue de updates pendientes
  const updateQueue = useRef<Record<string, number>>({});
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // PASO 1: Obtener o crear carrito
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
          .select('id')
          .eq('buyer_user_id', user.id)
          .eq('status', 'open')
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setCartId(data.id);
        } else {
          // Crear nuevo carrito
          const { data: newCart, error: createError } = await supabase
            .from('b2b_carts')
            .insert({ buyer_user_id: user.id, status: 'open' })
            .select('id')
            .single();

          if (createError) throw createError;
          setCartId(newCart.id);
        }
      } catch (err) {
        console.error('Error initializing cart:', err);
        setError('Error al inicializar carrito');
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
    setError(null);

    try {
      const { data, error } = await supabase.rpc('get_user_cart_shipping_cost', {
        p_user_id: user.id,
        p_shipping_type_id: selectedShippingTypeId
      });

      if (error) throw error;

      setShippingCost(data);
    } catch (err) {
      console.error('Error calculating shipping:', err);
      setError('Error calculando costo de envío');
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
                total_price: quantity * item.unit_price,
                updated_at: new Date().toISOString()
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
      setError('Error guardando cambios');
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
        return oldData.map((item: any) => 
          item.id === itemId 
            ? { ...item, cantidad: newQuantity, quantity: newQuantity }
            : item
        );
      }
      
      // Si tiene estructura { data: [...] }
      if (oldData.data && Array.isArray(oldData.data)) {
        return {
          ...oldData,
          data: oldData.data.map((item: any) => 
            item.id === itemId 
              ? { ...item, cantidad: newQuantity, quantity: newQuantity }
              : item
          )
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
    error,
    updateQuantity,
    forceSave,
    refetchShipping: calculateShippingCost
  };
}
