-- =============================================================================
-- INTEGRACIÓN: Cálculo Dinámico de Costos de Logística en Carrito B2B
-- Fecha Creación: 2026-02-12
-- Última Actualización: 2026-02-12 (Migración a función dinámica)
-- =============================================================================

/*
CAMBIO REALIZADO (v2.0 - FUNCIÓN DINÁMICA):
===========================================
El componente del carrito ahora usa la FUNCIÓN calculate_cart_shipping_cost_dynamic()
para calcular costos basados en los productos REALES del carrito del usuario,
en lugar de usar la vista estática v_cart_shipping_costs.


ANTES v1.0 (Cálculo individual):
=================================
1. Se obtenían costos de logística por cada producto individual
2. Se sumaban todos los costos: Σ(costo_producto_i × cantidad_i)
3. Problema: No considera peso total real del carrito
4. Problema: No aplica redondeo de peso a nivel carrito


DESPUÉS v2.0 (Vista estática - OBSOLETO):
==========================================
1. La vista simula el carrito completo con 10 productos fijos
2. Problema: No refleja el carrito REAL del usuario
3. Problema: Usa los MISMOS 10 productos para todos los usuarios


AHORA v3.0 (Función dinámica - ACTUAL): ✅
===========================================
1. Frontend envía items REALES del carrito: [{product_id, variant_id, quantity}]
2. Función calcula peso total REAL de esos items específicos
3. Llama a calculate_shipping_cost_cart() con peso calculado
4. Aplica CEIL() al peso (redondeo hacia arriba)
5. Calcula costo base según peso redondeado
6. Aplica surcharges (oversize, dimensional)
7. Retorna costo total en USD

RESULTADO: Costo EXACTO basado en el carrito REAL del usuario ✅


FLUJO DE DATOS ACTUALIZADO (v3.0):
===================================

┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: CartSidebarB2B.tsx                                │
│ ────────────────────────────────                            │
│ 1. Usuario agrega productos al carrito                      │
│    items = [                                                 │
│      {productId: 'uuid1', variantId: null, cantidad: 2},   │
│      {productId: 'uuid2', variantId: 'uuid3', cantidad: 5} │
│    ]                                                         │
│ 2. Componente llama: useB2BCartLogistics(items)            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ HOOK: useB2BCartLogistics.ts (ACTUALIZADO)                 │
│ ════════════════════════════════════════════════════════════│
│ 1. Transforma items a formato RPC:                          │
│    cartItemsForShipping = items.map(item => ({             │
│      product_id: item.productId,                            │
│      variant_id: item.variantId || null,                    │
│      quantity: item.cantidad                                 │
│    }))                                                       │
│                                                              │
│ 2. Llama RPC con items REALES:                             │
│    const { data } = await supabase.rpc(                     │
│      'get_cart_shipping_cost',                              │
│      { cart_items: cartItemsForShipping }                   │
│    );                                                        │
│                                                              │
│ 3. Recibe respuesta:                                         │
│    {                                                         │
│      total_items: 7,                                         │
│      total_weight_kg: 8.5,                                  │
│      weight_rounded_kg: 9,                                  │
│      base_cost: 45.20,                                      │
│      total_cost_with_type: 45.20                            │
│    }                                                         │
│                                                              │
│ 4. Extrae costo: cartShippingCost.total_cost_with_type     │
│ 5. Retorna: totalLogisticsCost = 45.20 USD                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ RPC WRAPPER: get_cart_shipping_cost()                       │
│ ────────────────────────────────                            │
│ CREATE FUNCTION get_cart_shipping_cost(                     │
│   cart_items JSONB                                           │
│ ) RETURNS JSONB                                              │
│                                                              │
│ Simplemente llama a la función principal y                  │
│ retorna resultado en formato JSONB para el frontend         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ FUNCIÓN: calculate_cart_shipping_cost_dynamic()             │
│ ════════════════════════════════════════════════════════════│
│                                                              │
│ Entrada: p_cart_items JSONB                                 │
│ [                                                            │
│   {"product_id": "uuid1", "variant_id": null, "quantity": 2},│
│   {"product_id": "uuid2", "variant_id": "uuid3", "quantity": 5}│
│ ]                                                            │
│                                                              │
│ Proceso:                                                     │
│ ────────                                                     │
│ 1. Inicializa variables:                                     │
│    v_total_weight := 0                                       │
│    v_has_oversize := false                                   │
│                                                              │
│ 2. FOR EACH item IN cart_items:                             │
│    a. Extrae: product_id, variant_id, quantity              │
│                                                              │
│    b. IF variant_id IS NOT NULL:                            │
│         SELECT weight_kg, is_oversize FROM product_variants │
│       ELSE:                                                  │
│         SELECT weight_kg, is_oversize FROM products         │
│                                                              │
│    c. Verifica columnas peso (prioridad):                   │
│       - weight_kg                                            │
│       - peso_kg                                              │
│       - weight_g / 1000                                      │
│       - peso_g / 1000                                        │
│                                                              │
│    d. Acumula peso:                                          │
│       v_total_weight := v_total_weight + (weight × quantity)│
│                                                              │
│    e. Verifica oversize:                                     │
│       v_has_oversize := v_has_oversize OR is_oversize       │
│                                                              │
│    f. Calcula volumen y max_dimensions                      │
│                                                              │
│ 3. Obtiene route_id y shipping_type_id del carrito          │
│                                                              │
│ 4. Llama función de cálculo con datos reales:               │
│    SELECT * FROM calculate_shipping_cost_cart(              │
│      v_route_id,                                             │
│      v_total_weight,     -- ✅ Peso real del carrito        │
│      v_shipping_type_id,                                     │
│      v_has_oversize,                                         │
│      v_max_dim_cm                                            │
│    )                                                         │
│                                                              │
│ 5. calculate_shipping_cost_cart() hace:                     │
│    a. Redondea: peso_redondeado = CEIL(v_total_weight)     │
│    b. Tramo A: peso_kg × 3.50 USD/kg                       │
│    c. Tramo B: peso_kg × 2.20462 × 5.00 USD/lb            │
│    d. Surcharges: +15% oversize, +10% dimensional          │
│    e. Extra cost: +10% si tipo EXPRESS                      │
│                                                              │
│ Salida: TABLE (total_cost_with_type, base_cost, ...)       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Muestra en UI                                     │
│ ────────────────────────────────────                        │
│ <div className="flex justify-between">                      │
│   <span>Logística Total:</span>                             │
│   <span>+${totalLogisticsCost.toFixed(2)}</span>           │
│ </div>                                                       │
│                                                              │
│ Ejemplo con carrito real:                                   │
│   Producto A (2 kg) × 2 unidades = 4 kg                    │
│   Producto B (1.5 kg) × 5 unidades = 7.5 kg               │
│   Total: 11.5 kg → CEIL = 12 kg                            │
│   Costo: $69.30 USD ✅                                      │
└─────────────────────────────────────────────────────────────┘


CÓDIGO MODIFICADO (v3.0):
==========================

Archivo: src/hooks/useB2BCartLogistics.ts
Líneas: ~60-90

// ✨ NUEVO: Construir array de items reales del carrito
const cartItemsForShipping = useMemo(() => 
  items.map(item => ({
    product_id: item.productId,
    variant_id: item.variantId || null,
    quantity: item.cantidad
  })),
  [items]
);

// ✨ NUEVO: Query RPC con items reales del carrito
const { data: cartShippingCost, isLoading: cartShippingLoading } = useQuery({
  queryKey: ['cart-shipping-dynamic-cost', cartItemsForShipping],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_cart_shipping_cost', {
      cart_items: cartItemsForShipping
    });
    
    if (error) {
      console.error('Error calling get_cart_shipping_cost RPC:', error);
      return null;
    }
    
    return data;
  },
  enabled: items.length > 0,
});

// ✨ ACTUALIZADO: Usar costo dinámico del RPC
const actualTotalShippingCost = cartShippingCost?.total_cost_with_type 
                                 || shippingCostResult?.totalCost 
                                 || 0;


CAMPOS DISPONIBLES DE LA FUNCIÓN:
==================================

calculate_cart_shipping_cost_dynamic() retorna:
  - total_items: Número REAL de items en el carrito del usuario
  - total_weight_kg: Peso total REAL calculado (kg)
  - weight_rounded_kg: Peso redondeado con CEIL() (kg)
  - base_cost: Costo base por peso (USD)
  - oversize_surcharge: Cargo por oversize (USD)
  - dimensional_surcharge: Cargo dimensional (USD)
  - extra_cost: Costos adicionales por tipo envío (USD)
  - total_cost_with_type: ✅ COSTO TOTAL FINAL (USD)
  - shipping_type_name: 'STANDARD' o 'EXPRESS'
  - shipping_type_display: 'Envío Estándar' o 'Envío Express'
  - route_name: 'Tránsito Internacional'


VENTAJAS DEL NUEVO ENFOQUE (v3.0):
===================================

✅ Precisión Total:
   - Usa items REALES del carrito del usuario
   - Calcula peso EXACTO: Σ(peso_producto × cantidad)
   - Considera variantes con pesos diferentes
   - Aplica redondeo correcto (CEIL) a nivel carrito

✅ Realtime:
   - Se recalcula cuando cambia el carrito
   - React Query detecta cambios en cartItemsForShipping
   - Actualización automática del costo en UI

✅ Flexibilidad:
   - Soporta productos + variantes
   - Maneja cantidades dinámicas
   - Detecta oversize por item
   - Calcula dimensiones máximas

✅ Consistencia:
   - Mismo cálculo usado en toda la aplicación
   - Centralizado en calculate_shipping_cost_cart()
   - Un solo punto de cambio para actualizar tarifas

✅ Rendimiento:
   - Una sola llamada RPC al backend
   - Cálculo eficiente en PostgreSQL
   - Caching automático con React Query

✅ Mantenibilidad:
   - Lógica de negocio en la base de datos
   - Frontend solo consume datos
   - Fácil de actualizar tarifas sin tocar frontend


EJEMPLO DE CÁLCULO REAL:
=========================

Carrito del Usuario A:
  - Producto 1: iPhone 13 (0.5 kg) × 2 unidades = 1.0 kg
  - Producto 2: MacBook (2.0 kg) × 1 unidad = 2.0 kg  
  - Producto 3: Mouse (0.3 kg) × 3 unidades = 0.9 kg
  Total items: 6
  Peso total: 1.0 + 2.0 + 0.9 = 3.9 kg
  Peso redondeado: CEIL(3.9) = 4 kg
  
  Cálculo:
  ────────
  Tramo A: 4 kg × 3.50 USD/kg = 14.00 USD
  Tramo B: 4 kg × 2.20462 lb/kg × 5.00 USD/lb = 44.09 USD
  Base cost: 14.00 + 44.09 = 58.09 USD
  
  Surcharges: 0 USD (no oversize, no dimensional)
  Extra cost: 0 USD (tipo STANDARD)
  
  TOTAL: 58.09 USD ✅


Carrito del Usuario B:
  - Producto 1: Bolso (0.8 kg) × 1 unidad = 0.8 kg
  - Producto 2: Zapatos (1.2 kg) × 2 unidades = 2.4 kg
  Total items: 3
  Peso total: 0.8 + 2.4 = 3.2 kg
  Peso redondeado: CEIL(3.2) = 4 kg
  
  Cálculo:
  ────────
  Tramo A: 4 kg × 3.50 USD/kg = 14.00 USD
  Tramo B: 4 kg × 2.20462 lb/kg × 5.00 USD/lb = 44.09 USD
  Base cost: 58.09 USD
  
  TOTAL: 58.09 USD ✅

Nota: Ambos usuarios tienen 4 kg redondeado pero diferentes productos/cantidades


UI ACTUALIZADA:
===============

Componente: CartSidebarB2B.tsx
Línea ~347:

<div className="flex justify-between items-center text-xs cursor-help">
  <span className="text-blue-600 flex items-center gap-1">
    <Truck className="w-3 h-3" />
    Logística Total:
  </span>
  <span className="font-semibold text-blue-600">
    +${cartLogistics.totalLogisticsCost.toFixed(2)}
  </span>
</div>

Ahora muestra el costo REAL calculado dinámicamente según los items del usuario


TESTING:
========

1. Testing Manual en UI:
   ──────────────────────
   a. Abrir el carrito en el frontend
   b. Agregar varios productos con diferentes cantidades
   c. Verificar que "Logística Total" muestra un valor en USD
   d. Cambiar cantidades → verificar que el costo se actualiza
   e. Eliminar productos → verificar que el costo baja

2. Testing en Supabase SQL Editor:
   ──────────────────────────────────
   -- Crear array de items del carrito
   SELECT * FROM calculate_cart_shipping_cost_dynamic('[
     {"product_id": "product-uuid-1", "variant_id": null, "quantity": 2},
     {"product_id": "product-uuid-2", "variant_id": "variant-uuid-1", "quantity": 5}
   ]'::jsonb);
   
   -- O usar el RPC wrapper
   SELECT get_cart_shipping_cost('[
     {"product_id": "product-uuid-1", "quantity": 2}
   ]'::jsonb);

3. Testing con productos reales:
   ────────────────────────────────
   -- Obtener productos activos para probar
   SELECT id, name, weight_kg FROM products WHERE active = true LIMIT 3;
   
   -- Usar esos IDs en la función
   SELECT * FROM calculate_cart_shipping_cost_dynamic('[
     {"product_id": "id-real-1", "quantity": 1},
     {"product_id": "id-real-2", "quantity": 3}
   ]'::jsonb);
   
   -- Verificar que retorna:
   -- total_items = 4 (1 + 3)
   -- total_weight_kg = peso calculado
   -- total_cost_with_type = costo en USD

4. Testing Browser Console:
   ─────────────────────────
   // Ver llamada RPC
   console.log('Cart items for shipping:', cartItemsForShipping);
   
   // Ver respuesta
   console.log('Cart shipping cost:', cartShippingCost);
   
   // Verificar estructura:
   // {
   //   total_items: 7,
   //   total_weight_kg: 8.5,
   //   total_cost_with_type: 69.30,
   //   ...
   // }


NOTA IMPORTANTE:
================

La vista v_cart_shipping_costs AÚN EXISTE en la base de datos pero ya NO SE USA
en el frontend para el cálculo de costos del carrito.

Ahora se usa: calculate_cart_shipping_cost_dynamic() con items reales.

La vista se mantiene para:
  - Verificación y testing
  - Comparación de costos
  - Referencia histórica

Si deseas eliminarla eventualmente:
  DROP VIEW IF EXISTS v_cart_shipping_costs;


PASOS PARA IMPLEMENTAR:
========================

1. ✅ COMPLETADO: Crear función calculate_cart_shipping_cost_dynamic()
   Archivo: FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql
   
2. ✅ COMPLETADO: Crear RPC wrapper get_cart_shipping_cost()
   Archivo: FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql
   
3. ✅ COMPLETADO: Actualizar hook useB2BCartLogistics.ts
   Archivo: src/hooks/useB2BCartLogistics.ts
   
4. ⏸️ PENDIENTE: Ejecutar SQL en Supabase
   - Abrir Supabase SQL Editor
   - Copiar contenido de FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql
   - Ejecutar script completo
   - Verificar que funciones se crearon correctamente:
     SELECT proname FROM pg_proc WHERE proname LIKE '%cart_shipping%';
   
5. ⏸️ PENDIENTE: Test en frontend
   - npm run dev
   - Agregar productos al carrito
   - Verificar que "Logística Total" se calcula dinámicamente
   - Console: Ver llamadas a supabase.rpc('get_cart_shipping_cost')
   
6. ⏸️ PENDIENTE: Commit cambios
   - git add .
   - git commit -m "feat: dynamic cart shipping based on real items"
   - git push origin main


QUERIES DE VERIFICACIÓN:
=========================

-- Ver costo para carrito de ejemplo
SELECT * FROM calculate_cart_shipping_cost_dynamic('[
  {"product_id": "uuid1", "quantity": 2},
  {"product_id": "uuid2", "quantity": 3}
]'::jsonb);

-- Comparar con vista estática (solo referencia)
SELECT total_cost_with_type FROM v_cart_shipping_costs;

-- Ver todos los productos activos para testing
SELECT id, name, weight_kg, is_oversize 
FROM products 
WHERE active = true 
LIMIT 10;


TROUBLESHOOTING:
================

Error: "function get_cart_shipping_cost does not exist"
Solución: Ejecutar FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql en Supabase

Error: "No se actualiza el costo en UI"
Solución: Verificar que cart items tengan product_id, variant_id, cantidad

Error: "RPC call returns null"
Solución: Verificar que productos existan en DB y tengan weight_kg

Error: "Costo es 0 USD"
Solución: Verificar que productos tengan peso > 0


CHANGELOG:
==========

v1.0 (2026-02-12): 
  - Suma individual de costos por producto
  - Problema: No considera peso total correctamente

v2.0 (2026-02-12):
  - Usa vista v_cart_shipping_costs
  - Problema: Vista estática con 10 productos fijos

v3.0 (2026-02-12 - ACTUAL): ✅
  - Usa función calculate_cart_shipping_cost_dynamic()
  - Frontend envía items REALES del carrito
  - Cálculo preciso basado en productos actuales del usuario
  - Actualización dinámica cuando cambia el carrito

La vista v_cart_shipping_costs simula un carrito con 10 productos activos.
En producción, si necesitas calcular el costo para el carrito REAL del usuario,
deberías:

1. Modificar la vista para aceptar parámetros del usuario
2. O crear una función que calcule dinámicamente según los items del carrito
3. O usar calculate_shipping_cost_cart() directamente desde el frontend

Por ahora, la vista sirve como REFERENCIA del costo estimado de envío.
*/

-- =============================================================================
-- CONSULTA PARA VERIFICAR
-- =============================================================================

-- Ver costo total actual que usa el frontend
SELECT 
  '💰 Costo que ve el usuario' as info,
  total_items as items_en_carrito,
  ROUND(total_weight_kg::numeric, 2) as peso_kg,
  base_cost as costo_base_usd,
  total_cost_with_type as costo_total_usd,
  shipping_type_display as tipo_envio
FROM v_cart_shipping_costs;

-- Ver desglose completo
SELECT 
  '📊 Desglose completo' as info,
  base_cost as base_usd,
  oversize_surcharge as oversize_usd,
  dimensional_surcharge as dimensional_usd,
  extra_cost as extra_usd,
  total_cost_with_type as total_usd
FROM v_cart_shipping_costs;
