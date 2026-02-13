// =============================================================================
// EJEMPLOS: Cuándo usar cada función de cálculo de costos de carrito
// =============================================================================

/*
RESUMEN DE FUNCIONES DISPONIBLES:
===================================

1. get_cart_shipping_cost(cart_items JSONB)
   - Frontend construye y pasa array de items
   - Archivo SQL: FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql
   
2. get_user_cart_shipping_cost(user_id UUID)
   - DB consulta b2b_cart_items internamente
   - Archivo SQL: FUNCION_CALCULAR_COSTO_CARRITO_USUARIO.sql

3. get_cart_id_shipping_cost(cart_id UUID)
   - Similar a #2 pero por cart_id específico
   - Archivo SQL: FUNCION_CALCULAR_COSTO_CARRITO_USUARIO.sql
*/


// =============================================================================
// EJEMPLO 1: Componente de Carrito (ACTUAL - USA OPCIÓN A)
// =============================================================================

// src/hooks/useB2BCartLogistics.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useB2BCartLogistics(items: B2BCartItem[]) {
  // ✅ OPCIÓN A: Frontend construye array y pasa items
  const cartItemsForShipping = useMemo(() => 
    items.map(item => ({
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.cantidad
    })),
    [items]
  );

  const { data: cartShippingCost } = useQuery({
    queryKey: ['cart-shipping-dynamic-cost', cartItemsForShipping],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cart_shipping_cost', {
        cart_items: cartItemsForShipping  // Pasa items explícitamente
      });
      
      if (error) throw error;
      return data;
    },
    enabled: items.length > 0,
  });

  return {
    totalLogisticsCost: cartShippingCost?.total_cost_with_type || 0,
    // ... otros campos
  };
}

// RAZÓN: Ya tenemos items en memoria/estado, no necesitamos consultar DB


// =============================================================================
// EJEMPLO 2: Backend Job - Cálculo Periódico de Costos
// =============================================================================

// backend/jobs/calculate-abandoned-carts-cost.ts

async function calculateAbandonedCartsCost() {
  // ✅ OPCIÓN B: Solo tenemos user_id, consultamos DB
  
  // 1. Obtener usuarios con carritos abandonados (más de 24h)
  const { data: abandonedCarts } = await supabase
    .from('b2b_carts')
    .select('buyer_user_id, created_at')
    .eq('status', 'open')
    .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  // 2. Calcular costo de cada carrito usando OPCIÓN B
  for (const cart of abandonedCarts || []) {
    const { data: shippingCost } = await supabase.rpc('get_user_cart_shipping_cost', {
      p_user_id: cart.buyer_user_id  // Solo pasamos user_id
    });
    
    console.log(`Usuario ${cart.buyer_user_id}: $${shippingCost.total_cost_with_type} USD`);
    
    // Enviar email con costo calculado
    await sendAbandonedCartEmail(cart.buyer_user_id, shippingCost);
  }
}

// RAZÓN: No tenemos items en memoria, más eficiente consultar desde DB


// =============================================================================
// EJEMPLO 3: API Endpoint - Obtener Costo del Carrito
// =============================================================================

// pages/api/b2b/cart/shipping-cost.ts

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'user_id required' });
  }
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // Service role
  );
  
  // ✅ OPCIÓN B: API solo recibe user_id, consulta DB
  const { data, error } = await supabase.rpc('get_user_cart_shipping_cost', {
    p_user_id: userId
  });
  
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  return res.status(200).json({
    userId,
    shippingCost: data.total_cost_with_type,
    totalWeight: data.total_weight_kg,
    items: data.total_items
  });
}

// RAZÓN: API más simple, no necesita construir array de items


// =============================================================================
// EJEMPLO 4: Testing - Calcular Costo de Items Mock
// =============================================================================

// src/hooks/useB2BCartLogistics.test.ts

import { renderHook } from '@testing-library/react-hooks';

describe('useB2BCartLogistics', () => {
  it('should calculate shipping cost for mock items', async () => {
    // ✅ OPCIÓN A: Testing con datos mock (no guardados en DB)
    const mockItems = [
      {
        id: 'item-1',
        productId: 'prod-uuid-1',
        variantId: null,
        cantidad: 2,
        precioB2B: 10.00,
        // ... otros campos
      },
      {
        id: 'item-2',
        productId: 'prod-uuid-2',
        variantId: 'variant-uuid-1',
        cantidad: 5,
        precioB2B: 15.00,
      }
    ];
    
    const { result, waitFor } = renderHook(() => 
      useB2BCartLogistics(mockItems)
    );
    
    await waitFor(() => result.current.totalLogisticsCost > 0);
    
    expect(result.current.totalLogisticsCost).toBeGreaterThan(0);
  });
});

// RAZÓN: Testing con mock data, no queremos tocar DB real


// =============================================================================
// EJEMPLO 5: Dashboard Admin - Ver Costos de Múltiples Usuarios
// =============================================================================

// src/components/admin/UserCartsCostDashboard.tsx

export function UserCartsCostDashboard() {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    // ✅ OPCIÓN B: Calcular costo para cada usuario
    async function loadUsersCosts() {
      const { data: activeUsers } = await supabase
        .from('b2b_carts')
        .select('buyer_user_id')
        .eq('status', 'open')
        .limit(100);
      
      const costs = await Promise.all(
        activeUsers.map(async (user) => {
          const { data } = await supabase.rpc('get_user_cart_shipping_cost', {
            p_user_id: user.buyer_user_id
          });
          
          return {
            userId: user.buyer_user_id,
            cost: data.total_cost_with_type,
            items: data.total_items,
            weight: data.total_weight_kg
          };
        })
      );
      
      setUsers(costs);
    }
    
    loadUsersCosts();
  }, []);
  
  return (
    <table>
      <thead>
        <tr>
          <th>Usuario</th>
          <th>Items</th>
          <th>Peso (kg)</th>
          <th>Costo Logística</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.userId}>
            <td>{user.userId}</td>
            <td>{user.items}</td>
            <td>{user.weight.toFixed(2)}</td>
            <td>${user.cost.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// RAZÓN: Dashboard consulta múltiples usuarios, OPCIÓN B más eficiente


// =============================================================================
// EJEMPLO 6: Calcular Costo Antes de Guardar en Carrito (Simulación)
// =============================================================================

// src/components/product/ProductQuickAddToCart.tsx

export function ProductQuickAddToCart({ productId, variantId }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState(0);
  
  // ✅ OPCIÓN A: Calcular costo SIN guardar en carrito (simulación)
  const calculateEstimatedCost = async () => {
    const temporaryItems = [
      {
        product_id: productId,
        variant_id: variantId,
        quantity: quantity
      }
    ];
    
    const { data } = await supabase.rpc('get_cart_shipping_cost', {
      cart_items: temporaryItems  // Items temporales, no guardados
    });
    
    setEstimatedCost(data.total_cost_with_type);
  };
  
  return (
    <div>
      <input 
        type="number" 
        value={quantity} 
        onChange={(e) => {
          setQuantity(parseInt(e.target.value));
          calculateEstimatedCost();
        }}
      />
      <p>Costo de envío estimado: ${estimatedCost.toFixed(2)}</p>
      <button onClick={addToCart}>Agregar al Carrito</button>
    </div>
  );
}

// RAZÓN: Calcular costo ANTES de guardar, items solo en memoria


// =============================================================================
// EJEMPLO 7: Webhook - Notificación de Costo al Completar Carrito
// =============================================================================

// supabase/functions/cart-completed-webhook/index.ts

Deno.serve(async (req) => {
  const { cart_id, user_id } = await req.json();
  
  // ✅ OPCIÓN B (variante): Usar cart_id específico
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data: shippingCost } = await supabaseClient.rpc('get_cart_id_shipping_cost', {
    p_cart_id: cart_id  // Usar cart_id específico
  });
  
  // Enviar notificación
  await fetch('https://api.notification-service.com/send', {
    method: 'POST',
    body: JSON.stringify({
      user_id,
      message: `Tu carrito tiene un costo de envío de $${shippingCost.total_cost_with_type} USD`,
      cart_details: {
        items: shippingCost.total_items,
        weight: shippingCost.total_weight_kg,
        cost: shippingCost.total_cost_with_type
      }
    })
  });
  
  return new Response('OK', { status: 200 });
});

// RAZÓN: Webhook recibe cart_id, consulta carrito específico desde DB


// =============================================================================
// RESUMEN: CUÁNDO USAR CADA OPCIÓN
// =============================================================================

/*
USA OPCIÓN A: get_cart_shipping_cost(cart_items JSONB)
=======================================================
✅ Componente de carrito con items en estado
✅ Testing con datos mock
✅ Simulación de costo antes de guardar
✅ Items temporales no guardados en DB
✅ Máxima flexibilidad


USA OPCIÓN B: get_user_cart_shipping_cost(user_id UUID)
========================================================
✅ Backend jobs periódicos
✅ API endpoints simples
✅ Dashboard admin
✅ Email notifications
✅ Webhooks
✅ Solo tienes user_id disponible


USA OPCIÓN B (variante): get_cart_id_shipping_cost(cart_id UUID)
=================================================================
✅ Tienes cart_id específico
✅ Múltiples carritos del mismo usuario
✅ Histórico de carritos cerrados
✅ Webhooks que reciben cart_id
*/
