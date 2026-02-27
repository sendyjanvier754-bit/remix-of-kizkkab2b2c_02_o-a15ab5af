# 🔍 AUDITORÍA: INCONSISTENCIAS EN CREACIÓN DE PEDIDOS

## ❌ PROBLEMA CRÍTICO ENCONTRADO

Hay **INCONSISTENCIAS** entre los dos lugares donde se crean pedidos en el sistema.

---

## 📊 COMPARACIÓN DETALLADA

### 1️⃣ **SellerCheckout.tsx** (Checkout principal)

**Ubicación:** [src/pages/seller/SellerCheckout.tsx](src/pages/seller/SellerCheckout.tsx#L250-L290)

#### orders_b2b - Inserción:
```typescript
await supabase.from('orders_b2b').insert({
  seller_id: user.id,               ✅
  buyer_id: user.id,                ✅
  total_amount: orderSubtotal,      ✅
  total_quantity: orderTotalQuantity, ✅
  payment_method: paymentMethod,    ✅
  payment_status: paymentStatus,    ✅ (calcula 'pending' o 'pending_validation')
  status: 'placed',                 ✅
  currency: 'USD',                  ✅
  metadata: metadata,               ✅
  
  // CAMPOS DE SHIPPING ✅
  shipping_tier_id: shippingData?.shippingTierId,
  shipping_cost_global_usd: shippingData?.shippingCostGlobalUsd,
  shipping_cost_local_usd: shippingData?.shippingCostLocalUsd,
  shipping_cost_total_usd: shippingData?.shippingCostTotalUsd,
  local_commune_id: shippingData?.localCommuneId,
  local_pickup_point_id: shippingData?.localPickupPointId,
})
```

#### order_items_b2b - Inserción:
```typescript
const orderItems = items.map(item => ({
  order_id: order.id,
  product_id: item.productId || null,
  sku: item.sku,
  nombre: item.name,
  cantidad: item.cantidad,
  precio_unitario: item.precioB2B,
  precio_total: item.subtotal,      // 👈 USA 'precio_total'
}));
```

---

### 2️⃣ **useB2BCartSupabase.ts** (Hook de carrito)

**Ubicación:** [src/hooks/useB2BCartSupabase.ts](src/hooks/useB2BCartSupabase.ts#L333-L370)

#### orders_b2b - Inserción:
```typescript
await supabase.from('orders_b2b').insert({
  seller_id: user.id,               ✅
  buyer_id: user.id,                ✅ (ya corregido)
  total_amount: cart.subtotal,      ✅
  total_quantity: cart.totalQuantity, ✅
  payment_method: paymentMethod,    ✅
  status: 'draft',                  ⚠️ DIFERENTE
  currency: 'USD',                  ✅
  metadata: shippingAddress ? { shipping_address: shippingAddress } : null, ✅
  
  // ❌ NO INCLUYE CAMPOS DE SHIPPING
  // shipping_tier_id: FALTA
  // shipping_cost_global_usd: FALTA
  // shipping_cost_local_usd: FALTA
  // shipping_cost_total_usd: FALTA
  // local_commune_id: FALTA
  // local_pickup_point_id: FALTA
  // payment_status: FALTA
})
```

#### order_items_b2b - Inserción:
```typescript
const orderItems = cart.items.map(item => ({
  order_id: order.id,
  product_id: item.productId,
  sku: item.sku,
  nombre: item.nombre,
  cantidad: item.quantity,
  precio_unitario: item.unitPrice,
  subtotal: item.totalPrice,        // 👈 USA 'subtotal' ❌ INCORRECTO
}));
```

---

## 🔴 PROBLEMAS IDENTIFICADOS

### Problema 1: Nombre de columna incorrecto en order_items_b2b

**useB2BCartSupabase.ts línea 358** usa:
```typescript
subtotal: item.totalPrice,  // ❌ COLUMNA NO EXISTE
```

**Pero debería usar:**
```typescript
precio_total: item.totalPrice,  // ✅ NOMBRE CORRECTO
```

**Evidencia:**
- ✅ SellerCheckout.tsx usa explícitamente `precio_total` (línea 282)
- ✅ types.ts define la columna como `precio_total` (línea 2089)
- ✅ El comentario en SellerCheckout dice: "La columna se llama precio_total, no subtotal"

### Problema 2: Faltan campos de shipping en useB2BCartSupabase

**Campos faltantes:**
- `payment_status` (importante para la máquina de estados de pago)
- `shipping_tier_id`
- `shipping_cost_global_usd`
- `shipping_cost_local_usd`
- `shipping_cost_total_usd`
- `local_commune_id`
- `local_pickup_point_id`

Esto causa que pedidos creados por useB2BCartSupabase no tengan información completa de envío.

### Problema 3: Diferente valor de status

- **SellerCheckout**: `status: 'placed'` (pedido confirmado)
- **useB2BCartSupabase**: `status: 'draft'` (borrador)

**Nota:** Esta diferencia podría ser intencional si useB2BCartSupabase solo crea borradores.

---

## 🔧 SOLUCIONES PROPUESTAS

### Solución 1: Corregir nombre de columna en useB2BCartSupabase

**Archivo:** `src/hooks/useB2BCartSupabase.ts`
**Línea:** 358

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

### Solución 2: Agregar campos de shipping a useB2BCartSupabase

Si useB2BCartSupabase debe crear pedidos completos (no solo borradores), agregar:
```typescript
payment_status: paymentMethod === 'stripe' ? 'pending' : 'pending_validation',
shipping_tier_id: shippingData?.shippingTierId ?? null,
shipping_cost_global_usd: shippingData?.shippingCostGlobalUsd ?? null,
shipping_cost_local_usd: shippingData?.shippingCostLocalUsd ?? null,
shipping_cost_total_usd: shippingData?.shippingCostTotalUsd ?? null,
local_commune_id: shippingData?.localCommuneId ?? null,
local_pickup_point_id: shippingData?.localPickupPointId ?? null,
```

---

## 📋 VERIFICACIÓN DE ESTRUCTURA REAL

### Según migraciones de base de datos:

**Archivo:** `supabase/migrations/20260115200006_remix_migration_from_pg_dump.sql` (línea 3880)

```sql
CREATE TABLE public.order_items_b2b (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    sku text NOT NULL,
    nombre text NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    descuento_percent numeric(5,2) DEFAULT 0.00,
    subtotal numeric(12,2) NOT NULL,  -- 👈 AQUÍ DICE 'subtotal'
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

**⚠️ CONTRADICCIÓN ENCONTRADA:**
- **Migración original:** columna se llama `subtotal`
- **types.ts (línea 2089):** columna se llama `precio_total`
- **SellerCheckout.tsx:** usa `precio_total`
- **useB2BCartSupabase.ts:** usa `subtotal`

### ❓ ¿Cuál es la verdad?

**Necesitamos ejecutar esta query en Supabase para confirmar:**

```sql
-- Ver estructura real de order_items_b2b
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'order_items_b2b'
ORDER BY ordinal_position;
```

---

## 🎯 ACCIÓN INMEDIATA REQUERIDA

1. **Ejecutar query de verificación** en Supabase SQL Editor
2. **Confirmar nombre de columna:** ¿es `subtotal` o `precio_total`?
3. **Corregir código según el resultado:**
   - Si es `subtotal`: Corregir SellerCheckout.tsx y types.ts
   - Si es `precio_total`: Corregir useB2BCartSupabase.ts (recomendado)
4. **Sincronizar ambos puntos de inserción** para usar los mismos parámetros
5. **Regenerar types.ts** desde Supabase para que coincida con la base real

---

## 🔎 COMANDOS PARA DIAGNÓSTICO

### Ver pedidos que fallaron por columna incorrecta:
```sql
-- Ver últimos 10 pedidos con sus items
SELECT 
  o.id AS order_id,
  o.status,
  o.created_at,
  COUNT(oi.id) AS num_items,
  CASE 
    WHEN COUNT(oi.id) = 0 THEN '❌ SIN ITEMS (posible error de inserción)'
    ELSE '✅ CON ITEMS'
  END AS estado_items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
GROUP BY o.id, o.status, o.created_at
ORDER BY o.created_at DESC
LIMIT 10;
```

### Ver errores recientes en logs (si están disponibles):
```sql
-- Esto depende de si tienes tabla de logs
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%order_items_b2b%' 
  AND calls > 0
ORDER BY last_exec_time DESC
LIMIT 10;
```

---

## 📝 RESUMEN

| Aspecto | SellerCheckout.tsx | useB2BCartSupabase.ts | Estado |
|---------|-------------------|------------------------|--------|
| Tabla orders_b2b | ✅ | ✅ | OK |
| seller_id | ✅ | ✅ | OK |
| buyer_id | ✅ | ✅ | OK (corregido) |
| payment_status | ✅ | ❌ | FALTA en hook |
| shipping_tier_id | ✅ | ❌ | FALTA en hook |
| shipping costs | ✅ | ❌ | FALTA en hook |
| local_commune_id | ✅ | ❌ | FALTA en hook |
| status | 'placed' | 'draft' | DIFERENTE |
| **Columna items** | **precio_total** ✅ | **subtotal** ❌ | **INCONSISTENTE** |

**CONCLUSIÓN:** useB2BCartSupabase.ts necesita corrección urgente del nombre de columna `subtotal` → `precio_total`.
