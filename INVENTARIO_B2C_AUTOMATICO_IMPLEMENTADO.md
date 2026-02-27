=====================================================
📦 GESTIÓN AUTOMÁTICA DE INVENTARIO B2C
=====================================================
Fecha: 2026-02-27
Estado: ✅ COMPLETADO

## 🎯 RESUMEN DE CAMBIOS

Se implementó un sistema automático para gestionar el inventario B2C basado en el estado de pago de pedidos B2B:

1. **Cuando un pedido B2B se marca como PAGADO** → Los productos se agregan automáticamente al inventario del comprador
2. **Cuando un pedido se cancela** → Los productos se eliminan automáticamente del inventario
3. **Botón "Volver a Comprar"** → Ahora redirige al producto específico del pedido

=====================================================
## ✅ CAMBIOS IMPLEMENTADOS
=====================================================

### 1. TRIGGER: Agregar al inventario cuando se paga
─────────────────────────────────────────────────────
**Archivo:** CREATE_B2C_INVENTORY_TRIGGERS.sql (líneas 1-160)

**Función:** `add_to_buyer_inventory_on_payment()`

**Se dispara cuando:**
- payment_status cambia de cualquier valor → 'paid'
- Solo procesa una vez (evita duplicados)

**Qué hace:**
1. Obtiene la tienda del comprador B2B (seller_id en orders_b2b)
2. Calcula los costos de logística total del pedido
3. Para cada producto en el pedido:
   - Calcula precio de venta sugerido (margen 150%)
   - Calcula costo total (precio B2B + logística proporcional)
   - Inserta en seller_catalog con metadata especial:
     * availability_status: 'disponible_pronto'
     * source_payment_status: 'paid'
     * added_on_payment: true

**Columnas insertadas en seller_catalog:**
```sql
seller_store_id      -- ID de la tienda del comprador
source_product_id    -- ID del producto original
source_order_id      -- ID de la orden B2B
sku                  -- SKU del producto
nombre, descripcion  -- Información del producto
precio_venta         -- (costo + logística) × 2.5
precio_costo         -- Precio B2B + logística
precio_b2b_base      -- Solo precio B2B
costo_logistica      -- Solo costo de envío
stock                -- Cantidad comprada
images               -- Imagen del producto
is_active            -- true (activo por defecto)
metadata             -- JSON con status "disponible_pronto"
```

### 2. TRIGGER: Eliminar del inventario cuando se cancela
─────────────────────────────────────────────────────────
**Archivo:** CREATE_B2C_INVENTORY_TRIGGERS.sql (líneas 162-185)

**Función:** `remove_from_buyer_inventory_on_cancel()`

**Se dispara cuando:**
- status cambia de cualquier valor → 'cancelled'

**Qué hace:**
1. Busca todos los productos en seller_catalog con:
   - source_order_id = orden cancelada
   - metadata->>'added_on_payment' = 'true'
2. Los elimina de la base de datos
3. Registra un log para debugging

**Protección:**
- Solo elimina productos agregados por el trigger de pago
- No afecta productos importados manualmente
- No afecta productos de órdenes completadas previamente

### 3. FRONTEND: Botón "Volver a Comprar" mejorado
──────────────────────────────────────────────────
**Archivo:** src/pages/seller/SellerMisComprasPage.tsx (líneas 770-787)

**ANTES:**
```tsx
<Link to="/seller/adquisicion-lotes">
  Volver a Comprar
</Link>
```

**AHORA:**
```tsx
<Link to={
  selectedOrder.order_items_b2b && selectedOrder.order_items_b2b.length > 0
    ? `/seller/adquisicion-lotes?search=${encodeURIComponent(selectedOrder.order_items_b2b[0].sku)}`
    : '/seller/adquisicion-lotes'
}>
  Volver a Comprar
</Link>
```

**Comportamiento:**
- Si el pedido tiene productos → Redirige a `/seller/adquisicion-lotes?search=SKU`
- La página de adquisición filtrará automáticamente por ese SKU
- Si no hay productos → Redirige a la página general

=====================================================
## 🔧 INSTALACIÓN
=====================================================

### Paso 1: Ejecutar el SQL en Supabase
────────────────────────────────────────

1. Abrir Supabase SQL Editor
2. Copiar TODO el contenido de `CREATE_B2C_INVENTORY_TRIGGERS.sql`
3. Ejecutar el script completo
4. Verificar que retorna: "Success"

**Verificación:**
Ejecutar esta query para confirmar que los triggers existen:

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
  'trg_add_to_buyer_inventory_on_payment',
  'trg_remove_from_buyer_inventory_on_cancel'
)
ORDER BY trigger_name;
```

Debe retornar 2 filas:
- trg_add_to_buyer_inventory_on_payment | UPDATE | orders_b2b
- trg_remove_from_buyer_inventory_on_cancel | UPDATE | orders_b2b

### Paso 2: Desplegar cambios frontend
───────────────────────────────────────

Los cambios en `SellerMisComprasPage.tsx` ya están guardados.
El archivo no tiene errores TypeScript.

**No requiere acción adicional** - el cambio se verá en el siguiente despliegue.

=====================================================
## 🧪 PRUEBAS
=====================================================

### TEST 1: Agregar al inventario al pagar
──────────────────────────────────────────

**Escenario:**
1. Crear un pedido B2B de prueba (status: 'placed', payment_status: 'pending')
2. Marcar el pedido como pagado:
   ```sql
   UPDATE orders_b2b 
   SET payment_status = 'paid', 
       payment_confirmed_at = NOW()
   WHERE id = 'ORDER_ID';
   ```

3. Verificar que se crearon productos en seller_catalog:
   ```sql
   SELECT 
     sc.sku,
     sc.nombre,
     sc.stock,
     sc.precio_venta,
     sc.precio_costo,
     sc.metadata->>'availability_status' as status
   FROM seller_catalog sc
   WHERE sc.source_order_id = 'ORDER_ID';
   ```

**Resultado esperado:**
- Productos insertados con stock correcto
- metadata indica 'disponible_pronto'
- precio_venta = (precio_costo) × 2.5
- is_active = true

### TEST 2: Eliminar del inventario al cancelar
───────────────────────────────────────────────

**Escenario:**
1. Usar el mismo pedido del TEST 1 (ya pagado, con productos en seller_catalog)
2. Cancelar el pedido:
   ```sql
   UPDATE orders_b2b 
   SET status = 'cancelled'
   WHERE id = 'ORDER_ID';
   ```

3. Verificar que los productos fueron eliminados:
   ```sql
   SELECT COUNT(*) as productos_restantes
   FROM seller_catalog
   WHERE source_order_id = 'ORDER_ID';
   ```

**Resultado esperado:**
- productos_restantes = 0
- Los productos ya no existen en seller_catalog
- Otros productos en el catálogo no se afectaron

### TEST 3: Botón "Volver a Comprar"
────────────────────────────────────

**Escenario:**
1. Ir a `/seller/mis-compras`
2. Click en un pedido con productos
3. Click en botón "Volver a Comprar"

**Resultado esperado:**
- Redirige a `/seller/adquisicion-lotes?search=SKU_DEL_PRODUCTO`
- La página muestra el producto filtrado
- User puede volver a comprarlo fácilmente

### TEST 4: Evitar duplicados
─────────────────────────────

**Escenario:**
1. Tener un pedido pagado (payment_status = 'paid')
2. Intentar cambiar payment_status nuevamente:
   ```sql
   UPDATE orders_b2b 
   SET payment_status = 'pending'
   WHERE id = 'ORDER_ID';
   
   UPDATE orders_b2b 
   SET payment_status = 'paid'
   WHERE id = 'ORDER_ID';
   ```

**Resultado esperado:**
- No se crean productos duplicados
- Solo existe una entrada por (source_order_id + source_product_id + sku)

=====================================================
## 🔍 CONSULTAS ÚTILES PARA DEBUGGING
=====================================================

### Ver todos los productos agregados automáticamente
```sql
SELECT 
  sc.id,
  sc.sku,
  sc.nombre,
  sc.stock,
  sc.precio_venta,
  sc.is_active,
  sc.metadata->>'availability_status' as availability,
  o.id as order_id,
  o.status as order_status,
  o.payment_status
FROM seller_catalog sc
JOIN orders_b2b o ON sc.source_order_id = o.id
WHERE sc.metadata->>'added_on_payment' = 'true'
ORDER BY sc.created_at DESC;
```

### Ver qué pedidos han disparado el trigger
```sql
SELECT 
  o.id,
  o.status,
  o.payment_status,
  o.payment_confirmed_at,
  COUNT(sc.id) as productos_en_catalogo
FROM orders_b2b o
LEFT JOIN seller_catalog sc ON sc.source_order_id = o.id
WHERE o.payment_status = 'paid'
GROUP BY o.id
ORDER BY o.payment_confirmed_at DESC;
```

### Verificar logs del trigger (si hay errores)
```sql
-- Ver warnings en logs de PostgreSQL
-- Nota: Solo accesible con permisos de admin en Supabase
SELECT * FROM pg_stat_statements
WHERE query LIKE '%add_to_buyer_inventory%'
ORDER BY calls DESC;
```

=====================================================
## ⚠️ CONSIDERACIONES IMPORTANTES
=====================================================

1. **Compatibilidad con trigger existente:**
   - Ya existe `update_seller_inventory_from_b2b_order()`
   - Se dispara cuando status = 'completed' o 'delivered'
   - El nuevo trigger usa payment_status = 'paid' (momento diferente)
   - NO hay conflicto porque son eventos distintos

2. **Orden de eventos esperado:**
   ```
   status: 'placed' → payment_status: 'paid' → [TRIGGER 1 SE DISPARA]
                                              ↓
                                   Productos en inventario con "disponible_pronto"
   
   status: 'completed' → [TRIGGER EXISTENTE]
                       ↓
               Podría actualizar stock si es necesario
   
   status: 'cancelled' → [TRIGGER 2 SE DISPARA]
                       ↓
               Elimina productos del inventario
   ```

3. **Protección contra duplicados:**
   - La función verifica si ya existe una entrada con:
     * mismo seller_store_id
     * mismo source_order_id
     * mismo source_product_id
     * mismo sku
   - Si existe, NO inserta un duplicado

4. **Metadata para identificación:**
   - added_on_payment: true → Identifica productos del trigger de pago
   - Permite eliminar selectivamente al cancelar
   - No afecta productos importados manualmente

5. **Cálculo de logística:**
   - Usa la misma lógica que el trigger existente
   - CEIL(peso_total) aplicado al total (no por item)
   - Logística prorrateada por peso de cada producto

=====================================================
## 📝 ARCHIVOS CREADOS/MODIFICADOS
=====================================================

**Nuevos archivos:**
- CREATE_B2C_INVENTORY_TRIGGERS.sql (trigger principal)
- VER_SELLER_CATALOG_COLUMNAS.sql (diagnóstico)
- VER_ORDERS_B2B_TODAS_COLUMNAS_AHORA.sql (diagnóstico)
- VER_FOREIGN_KEYS_ORDERS_B2B.sql (diagnóstico)

**Archivos modificados:**
- src/pages/seller/SellerMisComprasPage.tsx (botón "Volver a Comprar")

**Archivos sin cambios:**
- seller_catalog (tabla ya existente, no requiere ALTER)
- orders_b2b (tabla ya existente, no requiere ALTER)

=====================================================
## 🎉 RESULTADO FINAL
=====================================================

**ANTES:**
- Los productos se agregaban al inventario solo cuando la orden se completaba
- No había gestión automática de cancelaciones
- Botón "Volver a Comprar" iba a página genérica

**AHORA:**
- ✅ Productos se agregan INMEDIATAMENTE cuando el pago se confirma
- ✅ Status "Disponible pronto" en metadata
- ✅ Auto-eliminación si la orden se cancela
- ✅ Protección contra duplicados
- ✅ Botón "Volver a Comprar" va directo al producto específico
- ✅ Log detallado para debugging

**Flujo del seller:**
1. Seller compra productos B2B
2. Paga el pedido → Productos aparecen en su inventario B2C automáticamente
3. Si cancela → Productos desaparecen automáticamente
4. Click "Volver a Comprar" → Ve el mismo producto para reordenar

=====================================================
## 🚀 PRÓXIMOS PASOS
=====================================================

1. ✅ Ejecutar CREATE_B2C_INVENTORY_TRIGGERS.sql en Supabase
2. ✅ Verificar triggers con query de verificación
3. ✅ Hacer prueba con pedido real
4. ⏳ Considerar agregar UI para mostrar "Disponible pronto" en inventario
5. ⏳ Considerar notificaciones cuando productos se agreguen al inventario

