# 🎯 SOLUCIÓN COMPLETA: Guardar Peso en Carrito

## Problema Identificado
❌ **Costo de envío muestra $0.00** porque:
- Productos tienen peso configurado ✅
- Variantes NO tienen peso configurado ❌
- Cálculo de shipping depende de que las variantes tengan peso

## Solución Propuesta (Mejor Arquitectura)

### ✅ VENTAJAS
1. **Peso se calcula UNA VEZ** al agregar al carrito (desde `v_product_shipping_costs`)
2. **No depende de variantes** - usa el peso ya calculado con toda la lógica COALESCE
3. **Histórico preservado** - si el producto cambia de peso, el carrito mantiene el original
4. **Performance** - cálculo de shipping más rápido (no necesita JOINs complejos)
5. **Trigger para futuro** - nuevas variantes tendrán peso automáticamente

---

## 📋 Scripts a Ejecutar

### 1. Base de Datos (Supabase SQL Editor)

#### Script 1: Agregar columna peso_kg
**Archivo:** `AGREGAR_PESO_A_CART_ITEMS.sql`
```sql
-- Agrega columna peso_kg a b2b_cart_items
-- Actualiza items existentes con peso desde v_product_shipping_costs
-- Muestra resultado del costo de envío
```
**Ejecutar:** ✅ PRIMERO

---

#### Script 2: Crear función helper
**Archivo:** `FUNCION_GET_PRODUCT_WEIGHT.sql`
```sql
-- Crea función get_product_weight(product_id, variant_id)
-- Retorna el peso calculado para TypeScript
-- Incluye tests de validación
```
**Ejecutar:** ✅ SEGUNDO

---

#### Script 3: Trigger para futuras variantes
**Archivo:** `TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql`
```sql
-- Trigger que copia peso automáticamente a nuevas variantes
-- Solo actúa si variante no tiene peso propio
-- Garantiza que futuros productos tendrán peso
```
**Ejecutar:** ✅ TERCERO

---

### 2. Frontend (TypeScript)

#### Actualizar: `src/hooks/useB2BCartSupabase.ts`

**Línea ~185** - Modificar función `addItem`:

```typescript
const addItem = useCallback(async (item: {
  productId: string;
  variantId?: string | null;
  sku: string;
  nombre: string;
  unitPrice: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
}) => {
  if (!cart.id) return;

  try {
    // Buscar si item ya existe
    const existingItem = cart.items.find(
      i => i.sku === item.sku && 
           i.color === item.color && 
           i.size === item.size
    );

    if (existingItem) {
      // Actualizar cantidad
      const newQuantity = existingItem.quantity + item.quantity;
      const { error } = await supabase
        .from('b2b_cart_items')
        .update({
          quantity: newQuantity,
          total_price: newQuantity * item.unitPrice,
        })
        .eq('id', existingItem.id);

      if (error) throw error;
    } else {
      // ✅ NUEVO: Obtener peso del producto/variante
      const { data: peso_kg, error: weightError } = await supabase
        .rpc('get_product_weight', {
          p_product_id: item.productId,
          p_variant_id: item.variantId || null
        });

      if (weightError) {
        console.warn('Error getting weight, using 0:', weightError);
      }

      console.log(`📦 Adding ${item.sku} with weight: ${peso_kg || 0} kg`);

      // ✅ NUEVO: Insertar con peso_kg
      const { error } = await supabase
        .from('b2b_cart_items')
        .insert({
          cart_id: cart.id,
          product_id: item.productId,
          variant_id: item.variantId || null,
          sku: item.sku,
          nombre: item.nombre,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          total_price: item.quantity * item.unitPrice,
          peso_kg: peso_kg || 0,  // ✅ NUEVO
          color: item.color || null,
          size: item.size || null,
        });

      if (error) throw error;
    }

    await fetchOrCreateCart();
    toast.success('Producto agregado al carrito');
  } catch (error) {
    console.error('Error adding item:', error);
    toast.error('Error al agregar producto');
  }
}, [cart.id, cart.items, fetchOrCreateCart]);
```

---

### 3. Vista de Shipping (Actualizar)

#### Modificar: `v_cart_shipping_costs`

**Cambiar el cálculo de peso** para usar `bci.peso_kg` directamente:

```sql
CREATE OR REPLACE VIEW v_cart_shipping_costs AS
WITH user_active_cart AS (
  SELECT id as cart_id, buyer_user_id
  FROM b2b_carts
  WHERE buyer_user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1
),
cart_weight AS (
  SELECT 
    uc.cart_id,
    uc.buyer_user_id,
    COUNT(bci.id)::INTEGER as total_items,
    -- ✅ NUEVO: Usar peso guardado en cart_items
    SUM(COALESCE(bci.peso_kg, 0) * bci.quantity) as total_weight_kg
  FROM user_active_cart uc
  LEFT JOIN b2b_cart_items bci ON bci.cart_id = uc.cart_id
  GROUP BY uc.cart_id, uc.buyer_user_id
)
SELECT 
  cart_id,
  buyer_user_id,
  total_items,
  total_weight_kg,
  CEIL(total_weight_kg)::INTEGER as weight_rounded_kg,
  -- Cálculo de costo...
  CASE 
    WHEN total_weight_kg = 0 THEN 0
    WHEN CEIL(total_weight_kg) <= 1 THEN 11.05
    ELSE 11.05 + ((CEIL(total_weight_kg) - 1) * 5.82)
  END as total_cost_with_type,
  'STANDARD' as shipping_type_name,
  'Envío Estándar' as shipping_type_display,
  NULL::NUMERIC as volume_m3
FROM cart_weight;
```

---

## 🚀 Orden de Ejecución

### Fase 1: Base de Datos (5 min)
1. ✅ Ejecutar `AGREGAR_PESO_A_CART_ITEMS.sql`
2. ✅ Ejecutar `FUNCION_GET_PRODUCT_WEIGHT.sql`
3. ✅ Ejecutar `TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql`
4. ✅ Actualizar vista `v_cart_shipping_costs`

### Fase 2: Verificación Base de Datos (2 min)
```sql
-- Verificar que items tienen peso
SELECT * FROM b2b_cart_items WHERE peso_kg IS NOT NULL LIMIT 5;

-- Verificar función
SELECT get_product_weight('product-uuid'::uuid, null);

-- Verificar vista
SELECT * FROM v_cart_shipping_costs;
```

### Fase 3: Frontend (3 min)
1. ✅ Actualizar `src/hooks/useB2BCartSupabase.ts`
   - Modificar función `addItem` (línea ~185)
   - Agregar llamada a `get_product_weight`
   - Incluir `peso_kg` en el INSERT

### Fase 4: Testing (2 min)
1. ✅ Ir a `/seller/carrito`
2. ✅ Agregar un producto nuevo al carrito
3. ✅ Verificar en consola: `Adding {sku} with weight: X kg`
4. ✅ Verificar checkbox de envío muestra costo > $0
5. ✅ Seleccionar checkbox y ver total estimado correcto

---

## 📊 Resultados Esperados

### ANTES
```
Cart ID: 4fa2d7a2-b609-4666-8bb4-2ccc51c48bd7
Items: 2
Peso total: 0.0000 kg ❌
Costo envío: $0.00 ❌
```

### DESPUÉS (Actualización de Items Existentes)
```sql
-- Ejecutar AGREGAR_PESO_A_CART_ITEMS.sql
Cart ID: 4fa2d7a2-b609-4666-8bb4-2ccc51c48bd7
Items: 2
Peso total: 0.6 kg ✅ (guardado en bci.peso_kg)
Costo envío: $11.05 ✅
```

### DESPUÉS (Nuevos Items)
```
Agregar producto al carrito:
1. Frontend llama get_product_weight() → 0.3 kg
2. INSERT en b2b_cart_items con peso_kg = 0.3
3. Vista v_cart_shipping_costs usa bci.peso_kg
4. Checkbox muestra $11.05 ✅
```

---

## ✅ Checklist Completo

### Base de Datos
- [ ] Ejecutar AGREGAR_PESO_A_CART_ITEMS.sql
- [ ] Ejecutar FUNCION_GET_PRODUCT_WEIGHT.sql
- [ ] Ejecutar TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql
- [ ] Actualizar v_cart_shipping_costs
- [ ] Verificar items tienen peso_kg

### Frontend
- [ ] Actualizar useB2BCartSupabase.ts addItem()
- [ ] Agregar llamada a get_product_weight RPC
- [ ] Incluir peso_kg en INSERT de b2b_cart_items
- [ ] Testing: agregar producto y ver console.log

### Verificación
- [ ] Carrito existente muestra costo > $0
- [ ] Agregar nuevo producto guarda peso
- [ ] Checkbox funciona correctamente
- [ ] Total estimado incluye envío

---

## 🎁 Beneficios Adicionales

1. **Rendimiento**: Cálculo de envío más rápido (no JOINs complejos)
2. **Consistencia**: Peso "congelado" al agregar al carrito
3. **Histórico**: Auditoría de pesos al momento de compra
4. **Escalabilidad**: Trigger garantiza futuras variantes con peso
5. **Debugging**: Saber exactamente qué peso se usó en cada carrito

---

## 📝 Notas Importantes

- **Items existentes**: Se actualizan automáticamente con el script SQL
- **Nuevos items**: Usarán la función `get_product_weight()`
- **Vista actualizada**: `v_cart_shipping_costs` usará `bci.peso_kg`
- **Trigger activo**: Futuras variantes heredarán peso automáticamente
- **Zero downtime**: Se puede ejecutar sin afectar usuarios activos

---

¿Ejecutamos los scripts? 🚀
