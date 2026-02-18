-- ============================================================================
-- GUÍA DE MIGRACIÓN: Sistema de Shipping Seguro y con Tiers Correctos
-- ============================================================================
-- Fecha: 2026-02-18
-- Autor: GitHub Copilot
-- 
-- PROBLEMA RESUELTO:
-- ✅ Tiers usaban costos hardcodeados idénticos ($8.00/kg)
-- ✅ Funciones buscaban en shipping_type_configs (tabla antigua)
-- ✅ Frontend pasaba items (inseguro - manipulable)
-- ✅ Tipo de envío hardcodeado a STANDARD (ignoraba selección del usuario)
-- ============================================================================

-- ============================================================================
-- PASO 1: Actualizar costos de tiers con datos reales de segmentos
-- ============================================================================
-- Archivo: FIX_SHIPPING_TIERS_USE_ACTUAL_SEGMENT_COSTS.sql
-- ✅ YA EJECUTADO - Los tiers ahora tienen costos correctos:
--    - Express Aéreo: $7.00/kg + $11.02/lb (10-21 días)
--    - Standard Marítimo: $2.30/kg + $6.01/lb (37-55 días)


-- ============================================================================
-- PASO 2: Actualizar función calculate_shipping_cost_cart
-- ============================================================================
-- Archivo: FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql
-- 
-- QUÉ HACE:
-- - Función núcleo que calcula costo basado en peso + tier
-- - Ahora usa shipping_tiers (en lugar de shipping_type_configs)
-- - Ya recibe p_shipping_type_id como parámetro (estaba bien diseñada)
--
-- EJECUTAR:

\i 'FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql'

-- O copiar/pegar en Supabase SQL Editor


-- ============================================================================
-- PASO 3: Actualizar función get_user_cart_shipping_cost (SEGURA)
-- ============================================================================
-- Archivo: FIX_GET_USER_CART_SHIPPING_COST_WITH_TIER_SELECTION.sql
-- 
-- QUÉ HACE:
-- ✅ Consulta items desde b2b_cart_items (DB) - NO del frontend
-- ✅ Recibe user_id + shipping_type_id seleccionado
-- ✅ Calcula peso desde productos en DB
-- ✅ Imposible de manipular desde frontend
-- ✅ USA EL TIER QUE EL USUARIO SELECCIONÓ (no hardcodea STANDARD)
--
-- EJECUTAR:

\i 'FIX_GET_USER_CART_SHIPPING_COST_WITH_TIER_SELECTION.sql'

-- O copiar/pegar en Supabase SQL Editor


-- ============================================================================
-- PASO 4: Actualizar función calculate_cart_shipping_cost_dynamic (RECOMENDADO)
-- ============================================================================
-- Archivo: FIX_CALCULATE_CART_SHIPPING_COST_DYNAMIC_USE_TIERS.sql
-- 
-- ✅ USO VÁLIDO: Calcular preview EN TIEMPO REAL mientras usuario edita carrito
-- 
-- CASO DE USO IMPORTANTE:
-- - Usuario cambia cantidad de 2 a 5 unidades (no guardado aún)
-- - Necesita ver costo actualizado INMEDIATAMENTE
-- - Esta función calcula con las cantidades temporales del UI
--
-- SEGURIDAD:
-- ⚠️ Items vienen del frontend - OK para PREVIEW, NO para checkout
-- ✅ Backend SIEMPRE debe recalcular con get_user_cart_shipping_cost antes de procesar orden
--
-- QUÉ HACE:
-- - Recibe items desde frontend + shipping_type_id seleccionado
-- - Usa shipping_tiers en lugar de shipping_type_configs
-- - Calcula costo en tiempo real para preview
--
-- EJECUTAR:

\i 'FIX_CALCULATE_CART_SHIPPING_COST_DYNAMIC_USE_TIERS.sql'


-- ============================================================================
-- FRONTEND: Cómo llamar la función SEGURA
-- ============================================================================

/*
ANTES (INSEGURO - NO USAR):
============================

const { data } = await supabase.rpc('calculate_cart_shipping_cost_dynamic', {
  p_cart_items: cartItems.map(item => ({  ← ❌ Items del frontend (manipulable)
    product_id: item.productId,
    variant_id: item.variantId,
    quantity: item.quantity
  }))
});


AHORA (SEGURO - USAR ESTO):
=============================

// 1. Usuario selecciona el tipo de envío en el UI
const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

// 2. Llamar función que consulta items desde DB
const { data } = await supabase.rpc('get_user_cart_shipping_cost', {
  p_user_id: user.id,  // ✅ Solo user_id (auth.uid())
  p_shipping_type_id: selectedTierId  // ✅ Tier que el usuario seleccionó
});

// 3. El resultado incluye el costo con el tier seleccionado
console.log(data);
// {
//   total_items: 5,
//   total_weight_kg: 8.5,
//   total_cost_with_type: 89.50,  ← Costo con el tier seleccionado
//   shipping_type_name: "Express - Prioritario",
//   shipping_type_display: "Express aéreo - China → Haiti",
//   ...
// }


COMPONENTE REACT EJEMPLO:
===========================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function CartShippingCalculator() {
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Cargar tiers disponibles
  useEffect(() => {
    async function loadTiers() {
      const { data } = await supabase
        .from('shipping_tiers')
        .select('id, tier_name, custom_tier_name, transport_type')
        .eq('is_active', true)
        .order('priority_order');
      
      setTiers(data || []);
      // Seleccionar STANDARD por defecto
      const standard = data?.find(t => t.transport_type === 'maritimo');
      if (standard) setSelectedTierId(standard.id);
    }
    loadTiers();
  }, []);

  // Calcular costo cuando cambia el tier seleccionado
  useEffect(() => {
    async function calculateCost() {
      if (!selectedTierId) return;
      
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('get_user_cart_shipping_cost', {
        p_user_id: user.user.id,
        p_shipping_type_id: selectedTierId
      });
      
      if (!error && data) {
        setShippingCost(data.total_cost_with_type);
      }
      setLoading(false);
    }
    
    calculateCost();
  }, [selectedTierId]);

  return (
    <div>
      <h3>Tipo de Envío</h3>
      <select 
        value={selectedTierId || ''} 
        onChange={(e) => setSelectedTierId(e.target.value)}
      >
        {tiers.map(tier => (
          <option key={tier.id} value={tier.id}>
            {tier.custom_tier_name || tier.tier_name}
          </option>
        ))}
      </select>
      
      <div>
        <strong>Costo de Envío:</strong> 
        {loading ? 'Calculando...' : `$${shippingCost.toFixed(2)} USD`}
      </div>
    </div>
  );
}
*/


-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

-- Test 1: Verificar que tiers tienen costos correctos
SELECT 
  '📦 Tiers actualizados' as test,
  tier_name,
  custom_tier_name,
  transport_type,
  CONCAT(tramo_a_cost_per_kg, ' $/kg') as tramo_a,
  CONCAT(tramo_b_cost_per_lb, ' $/lb') as tramo_b,
  is_active
FROM shipping_tiers
WHERE route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
ORDER BY priority_order;

-- Resultado esperado:
-- Express Aéreo: 7.0000 $/kg, 11.0233 $/lb
-- Standard Marítimo: 2.3000 $/kg, 6.0139 $/lb


-- Test 2: Probar función segura con tier STANDARD
WITH test_user AS (
  SELECT buyer_user_id
  FROM b2b_carts
  WHERE status = 'open'
  LIMIT 1
),
standard_tier AS (
  SELECT id FROM shipping_tiers
  WHERE transport_type = 'maritimo' AND is_active = TRUE
  LIMIT 1
)
SELECT 
  '🧪 Test: Costo con STANDARD' as test,
  get_user_cart_shipping_cost(
    (SELECT buyer_user_id FROM test_user),
    (SELECT id FROM standard_tier)
  ) as resultado;


-- Test 3: Probar función segura con tier EXPRESS
WITH test_user AS (
  SELECT buyer_user_id
  FROM b2b_carts
  WHERE status = 'open'
  LIMIT 1
),
express_tier AS (
  SELECT id FROM shipping_tiers
  WHERE transport_type = 'aereo' AND is_active = TRUE
  LIMIT 1
)
SELECT 
  '🧪 Test: Costo con EXPRESS' as test,
  get_user_cart_shipping_cost(
    (SELECT buyer_user_id FROM test_user),
    (SELECT id FROM express_tier)
  ) as resultado;

-- Verificar que EXPRESS cuesta más que STANDARD ✅


-- ============================================================================
-- CHECKLIST DE MIGRACIÓN
-- ============================================================================

/*
☐ Paso 1: Ejecutar FIX_SHIPPING_TIERS_USE_ACTUAL_SEGMENT_COSTS.sql
   └─ ✅ YA COMPLETADO - Tiers tienen costos correctos

☐ Paso 2: Ejecutar FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql
   └─ Actualiza función núcleo para usar shipping_tiers

☐ Paso 3: Ejecutar FIX_GET_USER_CART_SHIPPING_COST_WITH_TIER_SELECTION.sql
   └─ Actualiza función segura para recibir tier seleccionado
   └─ Usa esta para checkout/órdenes/backend

☐ Paso 4: Ejecutar FIX_CALCULATE_CART_SHIPPING_COST_DYNAMIC_USE_TIERS.sql
   └─ Actualiza función para preview en tiempo real
   └─ Usa esta cuando usuario edita cantidades (antes de guardar)
   └─ Backend debe recalcular con Paso 3 antes de procesar pago

☐ Paso 5: Actualizar frontend
   └─ Cambiar de calculate_cart_shipping_cost_dynamic a get_user_cart_shipping_cost
   └─ Agregar selector de tipo de envío (tiers)
   └─ Pasar shipping_type_id seleccionado a la función RPC

☐ Paso 6: Testing
   └─ Verificar que Express cuesta más que Standard
   └─ Verificar que cambiar tier actualiza el costo
   └─ Verificar que items vienen de DB (no manipulables)

☐ Paso 7: Deploy
   └─ Ejecutar SQLs en producción
   └─ Desplegar cambios del frontend
   └─ Monitorear errores
*/


-- ============================================================================
-- RESUMEN DE BENEFICIOS
-- ============================================================================

/*
ANTES DE LA MIGRACIÓN:
======================
❌ Tiers con costos hardcodeados ($8.00/kg para todos)
❌ Express y Standard costaban lo mismo
❌ Funciones usaban shipping_type_configs (tabla antigua)
❌ Frontend pasaba items (inseguro, manipulable)
❌ Tipo de envío hardcodeado a STANDARD (ignoraba selección)

DESPUÉS DE LA MIGRACIÓN:
=========================
✅ Tiers con costos reales desde route_logistics_costs
✅ Express ($7/kg + $11/lb) vs Standard ($2.30/kg + $6/lb)
✅ Funciones usan shipping_tiers (tabla nueva)
✅ Items consultados desde b2b_cart_items (seguro, no manipulable)
✅ Usuario puede seleccionar tier (Express o Standard)
✅ Costo calculado según el tier seleccionado

SEGURIDAD MEJORADA:
===================
✅ Frontend solo pasa: user_id + shipping_type_id
✅ Items consultados desde DB (no del frontend)
✅ Pesos consultados desde DB (no del frontend)
✅ Cantidades consultadas desde DB (no del frontend)
✅ Imposible manipular el cálculo desde el navegador

FLEXIBILIDAD:
=============
✅ Admin puede crear nuevos tiers con nombres custom
✅ Admin puede ajustar costos desde el panel
✅ Botón "Cargar desde Segmentos" actualiza costos automáticamente
✅ País origen/destino auto-completados desde ruta (no editables)
*/


-- ============================================================================
-- ¿PREGUNTAS O PROBLEMAS?
-- ============================================================================

/*
Pregunta: ¿Puedo seguir usando calculate_cart_shipping_cost_dynamic?
Respuesta: Sí, pero NO es recomendado para producción porque recibe items 
           desde el frontend. Úsala solo para testing/desarrollo.

Pregunta: ¿Qué pasa si no paso shipping_type_id?
Respuesta: La función usará STANDARD (marítimo) por defecto.

Pregunta: ¿Cómo actualizar costos de tiers en el futuro?
Respuesta: 
  1. Actualizar route_logistics_costs con nuevos costos de segmentos
  2. En el admin, editar el tier y clic "Cargar desde Segmentos"
  3. O re-ejecutar FIX_SHIPPING_TIERS_USE_ACTUAL_SEGMENT_COSTS.sql

Pregunta: ¿Los cambios afectan carritos existentes?
Respuesta: No. Los carritos guardados mantienen sus costos. Solo los nuevos
           cálculos usarán los costos actualizados.

Pregunta: ¿Necesito regenerar tipos TypeScript?
Respuesta: Sí, después de ejecutar los SQLs:
           npx supabase gen types typescript --project-id <tu-project-id>
*/
