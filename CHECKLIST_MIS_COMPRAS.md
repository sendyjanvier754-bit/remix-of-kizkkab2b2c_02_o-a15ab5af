# 🔥 CHECKLIST COMPLETO: ¿Por qué no se muestran pedidos en Mis Compras?

## 🎯 ACCIÓN INMEDIATA

### Ejecuta AHORA en Supabase:
Abre [DIAGNOSTICO_RAPIDO_5_PASOS.sql](DIAGNOSTICO_RAPIDO_5_PASOS.sql) y ejecuta todo en Supabase SQL Editor.

**Esto te dirá EXACTAMENTE cuál es el problema.**

---

## ✅ FIXES APLICADOS (Ya corregidos en código)

### Fix 1: buyer_id en useB2BCartSupabase ✅
- **Archivo:** `src/hooks/useB2BCartSupabase.ts`
- **Línea:** 336
- **Cambio:** Ahora asigna `buyer_id: user.id`
- **Estado:** ✅ APLICADO

### Fix 2: Nombre de columna order_items_b2b ✅
- **Archivo:** `src/hooks/useB2BCartSupabase.ts`
- **Línea:** 357
- **Cambio:** `subtotal` → `precio_total`
- **Estado:** ✅ APLICADO

### Fix 3: Nombre de columna en useB2COrders ✅
- **Archivo:** `src/hooks/useB2COrders.ts`
- **Línea:** 134
- **Cambio:** `subtotal` → `precio_total`
- **Estado:** ✅ APLICADO

### Fix 4: payment_status agregado ✅
- **Archivo:** `src/hooks/useB2BCartSupabase.ts`
- **Línea:** 331-334
- **Cambio:** Calcula payment_status según método de pago
- **Estado:** ✅ APLICADO

---

## ⚠️ FIXES PENDIENTES (Necesitan ejecutarse en Supabase)

### Fix 5: RLS Policies ⏳
- **Archivo:** [FIX_ORDERS_RLS_COMPLETE.sql](FIX_ORDERS_RLS_COMPLETE.sql)
- **Estado:** ⏳ PENDIENTE - Necesitas ejecutarlo en Supabase
- **Crítico:** SÍ - Sin esto RLS puede bloquear pedidos

**Ejecuta esto:**
```sql
-- Copiar y pegar FIX_ORDERS_RLS_COMPLETE.sql en Supabase SQL Editor
```

---

## 🔍 POSIBLES CAUSAS (según diagnóstico)

### Causa 1: Pedidos están asignados a otro usuario
**Síntoma:** Diagnóstico paso 3️⃣ muestra "❌ NO SOY YO"

**Solución:**
```sql
-- Ver a quién pertenecen
SELECT buyer_id, seller_id, COUNT(*) 
FROM orders_b2b 
GROUP BY buyer_id, seller_id;

-- Si son tuyos pero con otro ID, ejecuta:
-- TRANSFERIR_PEDIDOS_OTRA_CUENTA.sql
```

### Causa 2: Todos los pedidos son draft
**Síntoma:** Diagnóstico paso 4️⃣ devuelve 0 pero 3️⃣ muestra pedidos

**Solución:**
```sql
-- Cambiar drafts a placed
UPDATE orders_b2b 
SET status = 'placed' 
WHERE buyer_id = auth.uid() 
  AND status = 'draft';
```

### Causa 3: RLS bloqueando
**Síntoma:** Diagnóstico paso 5️⃣ no muestra policies o están mal

**Solución:**
Ejecuta [FIX_ORDERS_RLS_COMPLETE.sql](FIX_ORDERS_RLS_COMPLETE.sql)

### Causa 4: No hay pedidos
**Síntoma:** Diagnóstico paso 2️⃣ muestra total_pedidos = 0

**Solución:**
Crea un pedido de prueba usando la aplicación

### Causa 5: Pedidos sin items
**Síntoma:** Diagnóstico paso 3️⃣ muestra items = 0

**Solución:**
Estos pedidos se crearon con el bug anterior. Crea uno nuevo después del fix.

### Causa 6: Cache del navegador
**Síntoma:** Diagnóstico paso 4️⃣ devuelve filas pero frontend no muestra

**Solución:**
1. Presiona `Ctrl + Shift + R` (recarga dura)
2. O abre en ventana incógnito
3. O limpia cache: Settings → Clear browsing data → Cached images

---

## 📋 PLAN DE ACCIÓN PASO A PASO

### PASO 1: Diagnóstico (2 minutos)
```bash
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Abre DIAGNOSTICO_RAPIDO_5_PASOS.sql
4. Ejecuta todo el script
5. Anota los resultados
```

### PASO 2: Según resultado del diagnóstico

#### Si paso 2️⃣ = 0 pedidos:
→ Crea un pedido de prueba en la app

#### Si paso 3️⃣ = "NO SOY YO":
→ Ejecuta query para ver IDs de pedidos:
```sql
SELECT DISTINCT buyer_id, 
  (SELECT email FROM auth.users WHERE id = buyer_id) 
FROM orders_b2b;
```
→ Si reconoces el email, es tu cuenta pero otro UUID
→ Ejecuta TRANSFERIR_PEDIDOS_OTRA_CUENTA.sql

#### Si paso 4️⃣ = 0 filas pero paso 3️⃣ tiene pedidos:
→ Son drafts o RLS bloqueando
→ Ejecuta FIX_ORDERS_RLS_COMPLETE.sql

#### Si paso 4️⃣ devuelve filas:
→ Problema en frontend
→ Recarga navegador (Ctrl+Shift+R)

### PASO 3: Verificación (1 minuto)
```bash
1. Recarga la app (Ctrl+Shift+R)
2. Ve a "Mis Compras"
3. ¿Se muestran ahora?
```

**Si SÍ:** ✅ ¡Problema resuelto!
**Si NO:** Vuelve al diagnóstico y compárteme los resultados

---

## 🚨 COMANDO DE EMERGENCIA

Si nada funciona, ejecuta esto para ver TODO sin filtros:

```sql
-- Ver TODOS los pedidos (como admin)
SELECT 
  o.id,
  o.created_at,
  o.buyer_id,
  (SELECT email FROM auth.users WHERE id = o.buyer_id) AS buyer_email,
  o.status,
  o.payment_status,
  COUNT(oi.id) AS items
FROM orders_b2b o
LEFT JOIN order_items_b2b oi ON oi.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.id, o.created_at, o.buyer_id, o.status, o.payment_status
ORDER BY o.created_at DESC
LIMIT 20;
```

**Comparte el resultado de esta query si sigues sin verlos.**

---

## 📝 RESUMEN EJECUTIVO

| Fix | Estado | Ubicación | Acción Requerida |
|-----|--------|-----------|------------------|
| buyer_id asignado | ✅ | Código | Listo |
| precio_total columna | ✅ | Código | Listo |
| payment_status | ✅ | Código | Listo |
| RLS policies | ⏳ | Database | **EJECUTAR FIX_ORDERS_RLS_COMPLETE.sql** |
| Diagnóstico | 📋 | - | **EJECUTAR DIAGNOSTICO_RAPIDO_5_PASOS.sql** |

---

## 🎯 TU ACCIÓN AHORA

1. **Ejecuta:** [DIAGNOSTICO_RAPIDO_5_PASOS.sql](DIAGNOSTICO_RAPIDO_5_PASOS.sql) en Supabase
2. **Dime qué sale en cada paso** (1️⃣ a 5️⃣)
3. **Te diré exactamente qué hacer** basado en los resultados

**¿Listo para ejecutar el diagnóstico?**
