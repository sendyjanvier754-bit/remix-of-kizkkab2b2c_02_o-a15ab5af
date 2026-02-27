# 🎯 PLAN DE CORRECCIÓN: Inconsistencia order_items_b2b

## 🔍 DIAGNÓSTICO CONFIRMADO

**LA COLUMNA SE LLAMA: `precio_total`** ✅ (según types.ts línea 2088)

### Archivo Correcto:
- ✅ **SellerCheckout.tsx** (línea 282) - usa `precio_total`
- ✅ **types.ts** (línea 2088) - define `precio_total`

### Archivo Incorrecto:
- ❌ **useB2BCartSupabase.ts** (línea 357) - usa `subtotal` (NO EXISTE)

---

## 🔴 ¿ESTO CAUSA QUE NO SE MUESTREN EN "MIS COMPRAS"?

### Respuesta: **SÍ, INDIRECTAMENTE**

### Análisis del Flujo:

1. **Usuario hace checkout usando useB2BCartSupabase.ts:**
   ```typescript
   // ESTO FUNCIONA (crea el order)
   await supabase.from('orders_b2b').insert({ 
     buyer_id: user.id,  // ✅ Ya corregido
     ...
   })
   
   // ESTO FALLA SILENCIOSAMENTE (error en columna)
   await supabase.from('order_items_b2b').insert([{
     subtotal: item.totalPrice  // ❌ Columna no existe
   }])
   ```

2. **Resultado:**
   - ✅ El pedido (order) SE CREA en orders_b2b
   - ❌ Los items (order_items) NO SE CREAN (error)
   - ⚠️ El pedido aparece en "Mis Compras" pero SIN PRODUCTOS

3. **En la UI:**
   - El pedido aparece en la lista
   - Al expandir detalles: **VACÍO** (0 productos)
   - Usuario piensa que no funcionó
   - Pérdida de datos de los productos comprados

### ¿Por qué el error no es visible?

```typescript
const { error: itemsError } = await supabase
  .from('order_items_b2b')
  .insert(orderItems);

if (itemsError) throw itemsError;  // ✅ Hace throw
```

El código SÍ hace throw, pero:
- Si el error no se muestra al usuario claramente
- O si se captura más arriba sin mostrar
- El usuario solo ve "error al crear pedido" sin detalles

---

## 📊 IMPACTO DEL PROBLEMA

### Gravedad: **CRÍTICA** 🔴

### Afectados:
- ❌ Pedidos creados vía `useB2BCartSupabase.createOrder()`
- ✅ Pedidos creados vía `SellerCheckout.tsx` (funcionan correctamente)

### Consecuencias:
1. **Pérdida de datos:** Pedidos sin items
2. **Mala experiencia:** Usuario no entiende qué compró
3. **Problemas financieros:** Total del pedido no coincide con items
4. **Reporte incorrecto:** Estadísticas de productos vendidos falsas
5. **Imposible fulfillment:** No se sabe qué enviar al cliente

---

## 🛠️ PLAN DE CORRECCIÓN

### FASE 1: Corrección Inmediata del Código

#### Fix 1: useB2BCartSupabase.ts (CRÍTICO)

**Archivo:** `src/hooks/useB2BCartSupabase.ts`
**Línea:** 357

**Cambiar:**
```typescript
const orderItems = cart.items.map(item => ({
  order_id: order.id,
  product_id: item.productId,
  sku: item.sku,
  nombre: item.nombre,
  cantidad: item.quantity,
  precio_unitario: item.unitPrice,
  subtotal: item.totalPrice,  // ❌ INCORRECTO
}));
```

**Por:**
```typescript
const orderItems = cart.items.map(item => ({
  order_id: order.id,
  product_id: item.productId,
  sku: item.sku,
  nombre: item.nombre,
  cantidad: item.quantity,
  precio_unitario: item.unitPrice,
  precio_total: item.totalPrice,  // ✅ CORRECTO
}));
```

#### Fix 2: Agregar campos faltantes (RECOMENDADO)

Agregar los mismos campos que usa SellerCheckout:
```typescript
await supabase.from('orders_b2b').insert({
  seller_id: user.id,
  buyer_id: user.id,
  total_amount: cart.subtotal,
  total_quantity: cart.totalQuantity,
  payment_method: paymentMethod,
  payment_status: paymentMethod === 'stripe' ? 'pending' : 'pending_validation',  // 🆕
  status: 'draft',
  currency: 'USD',
  metadata: shippingAddress ? { shipping_address: shippingAddress } : null,
  // 🆕 Campos de shipping (si están disponibles)
  shipping_tier_id: shippingData?.shippingTierId ?? null,
  shipping_cost_global_usd: shippingData?.shippingCostGlobalUsd ?? null,
  shipping_cost_local_usd: shippingData?.shippingCostLocalUsd ?? null,
  shipping_cost_total_usd: shippingData?.shippingCostTotalUsd ?? null,
  local_commune_id: shippingData?.localCommuneId ?? null,
  local_pickup_point_id: shippingData?.localPickupPointId ?? null,
})
```

---

### FASE 2: Verificación de Datos Existentes

#### Query 1: Identificar pedidos afectados

```sql
-- Ver pedidos SIN items (creados con el bug)
SELECT 
  o.id,
  o.created_at,
  o.buyer_id,
  o.total_amount,
  o.status,
  COUNT(oi.id) AS num_items,
  CASE 
    WHEN COUNT(oi.id) = 0 THEN '❌ SIN ITEMS - Bug detectado'
    ELSE '✅ Con items'
  END AS estado
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
GROUP BY o.id, o.created_at, o.buyer_id, o.total_amount, o.status
HAVING COUNT(oi.id) = 0  -- Solo pedidos sin items
ORDER BY o.created_at DESC
LIMIT 50;
```

#### Query 2: Estadísticas del problema

```sql
-- Estadísticas de pedidos afectados
SELECT 
  COUNT(DISTINCT o.id) AS total_pedidos_sin_items,
  SUM(o.total_amount) AS valor_total_afectado_usd,
  MIN(o.created_at) AS primer_pedido_afectado,
  MAX(o.created_at) AS ultimo_pedido_afectado,
  COUNT(DISTINCT o.buyer_id) AS usuarios_afectados
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE oi.id IS NULL  -- Sin items
  AND o.status != 'draft';  -- Excluir borradores normales
```

---

### FASE 3: Recuperación de Datos (OPCIONAL)

⚠️ **IMPORTANTE:** Los datos de items se perdieron. No se pueden recuperar automáticamente.

**Opciones:**

1. **Contactar usuarios afectados:**
   - Pedirles que vuelvan a hacer el pedido
   - Ofrecer descuento/compensación

2. **Si tienes logs del frontend:**
   - Buscar en localStorage
   - Buscar en logs de consola
   - Buscar en b2b_carts históricos

3. **Query para buscar en carritos:**
   ```sql
   -- Intentar recuperar items desde b2b_carts
   SELECT 
     o.id AS order_id,
     c.id AS cart_id,
     ci.sku,
     ci.nombre,
     ci.quantity,
     ci.unit_price,
     (ci.quantity * ci.unit_price) AS total
   FROM orders_b2b o
   LEFT JOIN b2b_carts c ON c.buyer_user_id = o.buyer_id 
     AND c.created_at::date = o.created_at::date
   LEFT JOIN b2b_cart_items ci ON ci.cart_id = c.id
   WHERE NOT EXISTS (
     SELECT 1 FROM order_items_b2b oi 
     WHERE oi.order_id = o.id
   )
   ORDER BY o.created_at DESC;
   ```

---

### FASE 4: Prevención Futura

#### 1. Tests Automatizados

```typescript
// test/useB2BCartSupabase.test.ts
describe('useB2BCartSupabase', () => {
  it('should create order with correct column names', async () => {
    // Verificar que usa 'precio_total' no 'subtotal'
    const orderItems = createOrderItems(mockCart);
    expect(orderItems[0]).toHaveProperty('precio_total');
    expect(orderItems[0]).not.toHaveProperty('subtotal');
  });
});
```

#### 2. Validación en Runtime

```typescript
// Agregar después del insert
const { data: itemsCount } = await supabase
  .from('order_items_b2b')
  .select('id', { count: 'exact', head: true })
  .eq('order_id', order.id);

if (itemsCount === 0) {
  console.error('❌ Order created but items failed to insert!');
  // Rollback order
  await supabase.from('orders_b2b').delete().eq('id', order.id);
  throw new Error('Failed to create order items');
}
```

#### 3. Regenerar types.ts regularmente

```bash
# Comando para regenerar types desde Supabase
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

---

## ✅ CHECKLIST DE EJECUCIÓN

### Inmediato (Hoy):
- [ ] **Fix 1:** Corregir useB2BCartSupabase.ts línea 357
- [ ] **Verificar:** Ejecutar Query 1 para ver pedidos afectados
- [ ] **Estadísticas:** Ejecutar Query 2 para magnitud del problema
- [ ] **Deploy:** Subir corrección a producción

### Corto Plazo (Esta Semana):
- [ ] **Fix 2:** Agregar campos faltantes de shipping
- [ ] **Contactar usuarios:** Si hay pedidos afectados recientes
- [ ] **Documentar:** Actualizar documentación de creación de pedidos

### Largo Plazo (Próximo Sprint):
- [ ] **Tests:** Implementar tests automatizados
- [ ] **Validación:** Agregar validación de items después de crear orden
- [ ] **Monitoring:** Alertas si se crean pedidos sin items
- [ ] **Regenerar types:** Automatizar regeneración desde Supabase

---

## 🎯 PRIORIDAD DE FIXES

### 🔴 CRÍTICO (Fix Inmediato):
1. ✅ Corregir `subtotal` → `precio_total` en useB2BCartSupabase.ts

### 🟡 IMPORTANTE (Fix Esta Semana):
2. ⚠️ Agregar `payment_status` (afecta máquina de estados)
3. ⚠️ Verificar pedidos afectados (Query 1 y 2)

### 🟢 RECOMENDADO (Próximo Sprint):
4. 💡 Agregar campos de shipping completos
5. 💡 Implementar validación de items post-creación
6. 💡 Tests automatizados

---

## 📝 RESUMEN EJECUTIVO

**Problema:** `useB2BCartSupabase.ts` usa columna `subtotal` que no existe. La columna real es `precio_total`.

**Impacto:** Pedidos se crean sin items. Usuario ve pedido vacío en "Mis Compras".

**Solución:** Cambiar 1 palabra en 1 línea: `subtotal:` → `precio_total:`

**Tiempo estimado:** 
- Fix: 2 minutos
- Testing: 10 minutos
- Deploy: 5 minutos
- **Total: 17 minutos**

**Riesgo de no corregir:** 
- Pérdida continua de datos de items
- Insatisfacción del cliente
- Imposible procesar pedidos

---

## 🚀 ¿EMPEZAMOS CON EL FIX?

Puedo aplicar la corrección ahora mismo. ¿Quieres que:

1. ✅ **Aplique Fix 1** (cambio de subtotal a precio_total) - **RECOMENDADO**
2. 📊 **Primero ejecutes las queries** para ver si hay pedidos afectados
3. 🔧 **Aplique Fix 1 + Fix 2** (incluir todos los campos) - **IDEAL**

¿Cuál prefieres?
