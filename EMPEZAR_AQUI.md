# 🎯 PLAN DE EJECUCIÓN: Guardar Peso Específico de Cada Variante

## ✅ IMPORTANTE: Cada variante puede tener peso diferente

**Ejemplo Real:**
```
Producto: Camiseta (peso base: 0.2 kg)
  └─ Variante S: 0.18 kg  ← Peso propio de la variante
  └─ Variante M: 0.2 kg   ← Usa peso del producto
  └─ Variante XL: 0.25 kg ← Peso propio de la variante
```

**Al agregar al carrito:**
- Se consulta el peso **específico** de esa variante
- Se guarda en `b2b_cart_items.peso_kg`
- Cada fila del carrito tiene el peso correcto de SU variante

---

## 📋 Scripts a Ejecutar (EN ORDEN)

### 1️⃣ AGREGAR_PESO_A_CART_ITEMS.sql ⏱️ ~5 segundos

**Qué hace:**
- Agrega columna `peso_kg` a tabla `b2b_cart_items`
- Actualiza items existentes con peso específico de cada variante
- Muestra resultado con costo de envío calculado

**Ejecutar:** Supabase SQL Editor → Copiar todo → Run
**Resultado esperado:** Items actualizados con peso específico

---

### 2️⃣ FUNCION_GET_PRODUCT_WEIGHT.sql ⏱️ ~3 segundos

**Qué hace:**
- Crea función `get_product_weight(product_id, variant_id)`
- Retorna peso **específico** de esa combinación producto+variante
- TypeScript la llamará antes de insertar en el carrito
- Incluye tests de validación

**Ejecutar:** Supabase SQL Editor → Copiar todo → Run
**Resultado esperado:** Función creada + tests pasan

---

### 3️⃣ TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql ⏱️ ~5 segundos

**Qué hace:**
- Trigger automático para futuras variantes sin peso
- Si variante nueva no tiene peso → copia del producto
- Si variante nueva tiene peso propio → lo respeta
- Garantiza que futuras variantes tendrán peso

**Ejecutar:** Supabase SQL Editor → Copiar todo → Run
**Resultado esperado:** Trigger creado + 3 tests pasan

---

### 4️⃣ Actualizar v_cart_shipping_costs (Vista)

**Modificar la vista** para usar `bci.peso_kg` directamente:

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
    -- ✅ Usar peso guardado en cart_items (específico de cada variante)
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
  -- Base cost
  11.05 as base_cost,
  -- Calculate extra cost for weight > 1kg
  CASE 
    WHEN total_weight_kg = 0 THEN 0
    WHEN CEIL(total_weight_kg) <= 1 THEN 0
    ELSE (CEIL(total_weight_kg) - 1) * 5.82
  END as extra_cost,
  -- Oversize and dimensional surcharges (currently 0)
  0 as oversize_surcharge,
  0 as dimensional_surcharge,
  -- Total cost
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

**Ejecutar:** Supabase SQL Editor

---

### 5️⃣ Actualizar TypeScript: useB2BCartSupabase.ts

**Archivo:** `src/hooks/useB2BCartSupabase.ts`  
**Línea:** ~185 (función `addItem`)

**Cambio:**

```typescript
const addItem = useCallback(async (item: {
  productId: string;
  variantId?: string | null;  // ✅ ID específico de variante
  sku: string;
  nombre: string;
  unitPrice: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
}) => {
  if (!cart.id) return;

  try {
    // Buscar si item ya existe (mismo producto + variante)
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
      // ✅ NUEVO: Obtener peso específico de esta variante
      const { data: peso_kg, error: weightError } = await supabase
        .rpc('get_product_weight', {
          p_product_id: item.productId,
          p_variant_id: item.variantId || null
        });

      if (weightError) {
        console.warn('Error getting weight:', weightError);
      }

      console.log(`📦 Adding ${item.sku} (variant: ${item.variantId || 'none'}) - weight: ${peso_kg || 0} kg`);

      // ✅ NUEVO: Insertar con peso específico
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
          peso_kg: peso_kg || 0,  // ✅ Peso específico de ESTA variante
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

## 🧪 Verificación

### Después de ejecutar scripts SQL:

```sql
-- Ver items con peso específico
SELECT 
  bci.id,
  p.nombre,
  pv.name as variante,
  bci.peso_kg as "peso_guardado",
  bci.quantity
FROM b2b_cart_items bci
JOIN products p ON bci.product_id = p.id
LEFT JOIN product_variants pv ON bci.variant_id = pv.id
WHERE bci.peso_kg IS NOT NULL
LIMIT 10;

-- Ver costo de envío
SELECT * FROM v_cart_shipping_costs;
```

### Después de actualizar TypeScript:

1. Ir a `/seller/carrito`
2. Agregar un producto con variante al carrito
3. Ver en consola: `📦 Adding SKU-123 (variant: xxx) - weight: 0.3 kg`
4. Verificar checkbox muestra costo > $0
5. Seleccionar checkbox → total estimado correcto

---

## 📊 Ejemplo Completo

### TU CASO REAL:

**Carrito actual:**
```
Cart: 4fa2d7a2-b609-4666-8bb4-2ccc51c48bd7
Items: 2
Peso: 0.0000 ❌
Costo: $0.00 ❌
```

**Después de ejecutar scripts:**
```
Cart: 4fa2d7a2-b609-4666-8bb4-2ccc51c48bd7
Items: 2
Item 1: Variante A → peso_kg = 0.3 kg ✅
Item 2: Variante B → peso_kg = 0.3 kg ✅
Peso total: 0.6 kg ✅
Costo: $11.05 ✅
```

**Al agregar nuevos productos:**
```typescript
// Variante S (peso propio: 0.18 kg)
addItem({ variantId: 'variant-s-id', ... })
→ guarda peso_kg = 0.18 ✅

// Variante XL (peso propio: 0.25 kg)
addItem({ variantId: 'variant-xl-id', ... })
→ guarda peso_kg = 0.25 ✅

// Carrito ahora:
// Item 1: 0.3 kg
// Item 2: 0.3 kg
// Item 3: 0.18 kg (S)
// Item 4: 0.25 kg (XL)
// Total: 1.03 kg → 2 kg redondeado → $16.87
```

---

## ✅ Checklist

### Base de Datos (10 min)
- [ ] Ejecutar AGREGAR_PESO_A_CART_ITEMS.sql
- [ ] Ejecutar FUNCION_GET_PRODUCT_WEIGHT.sql
- [ ] Ejecutar TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql
- [ ] Actualizar v_cart_shipping_costs
- [ ] Verificar: `SELECT * FROM b2b_cart_items WHERE peso_kg IS NOT NULL`

### Frontend (5 min)
- [ ] Abrir `src/hooks/useB2BCartSupabase.ts`
- [ ] Localizar función `addItem` (línea ~185)
- [ ] Agregar llamada a `get_product_weight` RPC
- [ ] Incluir `peso_kg` en INSERT
- [ ] Guardar archivo

### Testing (3 min)
- [ ] Frontend: npm run dev
- [ ] Ir a `/seller/carrito`
- [ ] Agregar producto al carrito
- [ ] Ver console.log con peso
- [ ] Verificar checkbox muestra costo
- [ ] ✅ Done!

---

## 🚀 ¿EMPEZAMOS?

**PASO 1:** Ejecuta `AGREGAR_PESO_A_CART_ITEMS.sql` en Supabase  
**PASO 2:** Dime cómo salió y continuamos con el siguiente

🎯 La solución está lista - cada variante tendrá su peso específico guardado en el carrito.
