# 📊 LÓGICA COMPLETA DE LOGÍSTICA - FLUJO DESDE BD HASTA FRONTEND

## 🎯 RESUMEN EJECUTIVO

```
ORIGEN DE DATOS → CÁLCULO DE PESO → REDONDEO → CÁLCULO DE COSTO → FRONTEND
```

---

## 📍 PASO 1: ORIGEN DE LOS DATOS DE PESO

### 1.1 Tablas Base (Datos Iniciales)

**Tabla: `products`**
```sql
id (UUID)
peso_kg (NUMERIC) — peso en kg
peso_g (NUMERIC)  — peso en gramos
```

**Tabla: `product_variants`**
```sql
id (UUID)
product_id (UUID) — referencia al producto
peso_kg (NUMERIC) — peso específico de la variante (si es diferente al producto)
peso_g (NUMERIC)  — peso en gramos
```

### 1.2 Dónde se Guardan los Pesos en el Carrito

**Tabla: `b2b_cart_items`**
```sql
id (UUID)
cart_id (UUID)
product_id (UUID)
variant_id (UUID)  — puede ser NULL
quantity (INTEGER) — cantidad de unidades
peso_kg (NUMERIC)  — PESO DE UN ITEM (una unidad)
                     ↑ CRÍTICO: Este es el peso individual
```

**Tabla: `b2b_carts`**
```sql
id (UUID)
total_weight_kg (NUMERIC)   — peso TOTAL del carrito (suma de todos los items)
shipping_cost_usd (NUMERIC) — costo TOTAL de envío
```

---

## ⚙️ PASO 2: CÁLCULO Y POBLACIÓN DEL PESO

### 2.1 ¿De Dónde Viene peso_kg en Cart Items?

**OPCIÓN A: TRIGGER AUTOMÁTICO (Recomendado)**
```sql
TRIGGER: trigger_calculate_cart_item_weight
ARCHIVO: TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql

SE DISPARA CUANDO:
  - INSERT en b2b_cart_items o b2c_cart_items
  - UPDATE en b2b_cart_items o b2c_cart_items

LÓGICA (Función: fn_calculate_cart_item_weight):
  
  IF NEW.peso_kg IS NULL OR NEW.peso_kg = 0 THEN
    -- Prioridad: Variante > Producto > Default (300g)
    NEW.peso_kg := COALESCE(
      pv.peso_kg,              -- 1. Peso de variante en kg
      p.peso_kg,               -- 2. Peso de producto en kg
      pv.peso_g / 1000.0,      -- 3. Peso de variante en g convertido a kg
      p.peso_g / 1000.0,       -- 4. Peso de producto en g convertido a kg
      0.3                      -- 5. Default: 300g = 0.3kg
    )
  END IF;
```

**RESULTADO:** Cada item en carrito tiene `peso_kg` = peso de UNA UNIDAD

### 2.2 Para Items Existentes (Fallback)

```sql
-- Si el trigger no existía y hay items sin peso_kg
EJECUTAR: ACTUALIZAR_PESO_ITEMS_AHORA.sql

UPDATE b2b_cart_items bci
SET peso_kg = COALESCE(
  pv.peso_kg,
  p.peso_kg,
  pv.peso_g / 1000.0,
  p.peso_g / 1000.0,
  0.3
)
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE bci.variant_id = pv.id
  AND bci.peso_kg IS NULL;
```

---

## 📦 PASO 3: CÁLCULO DEL PESO TOTAL (Sin Redondeo Aún)

### 3.1 En la Vista SQL: `v_cart_shipping_costs`

```sql
VIEW: v_cart_shipping_costs
ARCHIVO: (parte de varias migraciones)

CÁLCULO:
  -- Suma CADA item: peso_individual × cantidad
  total_weight_kg = SUM(
    COALESCE(bci.peso_kg, 0.3) * bci.quantity
  )
  FOR EACH item IN carrito
```

**EJEMPLO (SIN REDONDEO):**
```
Item 1: peso_kg=0.5 × cantidad=1 = 0.5 kg
Item 2: peso_kg=0.25 × cantidad=2 = 0.5 kg
Item 3: peso_kg=0.1 × cantidad=5 = 0.5 kg

total_weight_kg (sin redondear) = 0.5 + 0.5 + 0.5 = 1.5 kg
                                  ↑ Este es un número decimal exacto
```

### 3.2 Cálculo en el Frontend (useCartShippingCostView)

```typescript
// Hook: useCartShippingCostView
// Archivo: src/hooks/useCartShippingCostView.ts

CONSULTA:
  SELECT * FROM v_cart_shipping_costs
  WHERE cart_items IN (selectedItemIds)

RESULTADO DEVUELTO AL FRONTEND:
  {
    total_weight_kg: 1.5,        // Peso exacto sin redondear
    total_items: 3,
    shipping_cost: 15.95,
    // ... más datos
  }
```

---

## 🔄 PASO 4: REDONDEO DEL PESO

### 4.1 ¿DÓNDE se redondea? → EN SQL (base de datos)

**Ubicación: Función `calculate_shipping_cost_cart()`**
```sql
ARCHIVO: MIGRACION_COMPLETA_LOGISTICA_2026-02-10.sql
LÍNEA: ~150

CREATE FUNCTION calculate_shipping_cost_cart(
  p_cart_id UUID,
  p_weight_kg NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_rounded_weight NUMERIC;
  v_base_cost NUMERIC;
  v_tramo_a NUMERIC;
  v_tramo_b NUMERIC;
BEGIN
  -- 🔴 REDONDEO HACIA ARRIBA (CEIL)
  v_rounded_weight := CEIL(p_weight_kg);
  
  -- Obtener costos del tramo A y B de shipping_tiers
  SELECT tramo_a_cost_per_kg, tramo_b_cost_per_kg
  INTO v_tramo_a, v_tramo_b
  FROM shipping_tiers
  WHERE shipping_type_id = (SELECT shipping_type_id FROM b2b_carts WHERE id = p_cart_id)
  LIMIT 1;
  
  -- Calcular costo con peso REDONDEADO
  v_base_cost := (v_rounded_weight * v_tramo_a) + (v_rounded_weight * v_tramo_b);
  
  RETURN v_base_cost;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Ejemplos de Redondeo

```
Peso Original → Redondeado
1.0 kg        → 1 kg
1.5 kg        → 2 kg  (redondea hacia arriba)
1.1 kg        → 2 kg  (redondea hacia arriba)
2.9 kg        → 3 kg  (redondea hacia arriba)
3.0 kg        → 3 kg  (sin cambio)
```

**Función SQL usada: CEIL()**
```sql
CEIL(1.5) = 2
CEIL(1.0) = 1
CEIL(1.1) = 2
```

---

## 💰 PASO 5: CÁLCULO DEL COSTO DE ENVÍO

### 5.1 Estructura de Costos

**Tablas Involucradas:**
```sql
-- 1. route_logistics_costs (Tramos)
id
shipping_route_id (ruta: China → Haiti)
segment ('china_to_transit' → Tramo A, 'transit_to_destination' → Tramo B)
cost_per_kg (NUMERIC) — costo por kg en este tramo

-- 2. shipping_tiers (Consolidado por tipo de envío)
id
shipping_type_id ('express', 'standard', etc.)
tramo_a_cost_per_kg (NUMERIC) — costo Tramo A
tramo_b_cost_per_kg (NUMERIC) — costo Tramo B
```

### 5.2 Fórmula de Cálculo

**Costo Total = (Peso_Redondeado × Tramo_A_Costo) + (Peso_Redondeado × Tramo_B_Costo)**

**En SQL:**
```sql
v_shipping_cost := 
  (v_rounded_weight * v_tramo_a_cost_per_kg) +
  (v_rounded_weight * v_tramo_b_cost_per_kg);
```

**EJEMPLO REAL:**
```
Peso original: 1.5 kg
Peso redondeado: CEIL(1.5) = 2 kg

Tramo A (China → Transit):    $3.50 por kg
Tramo B (Transit → Haití):     $2.75 por kg

Costo = (2 × $3.50) + (2 × $2.75)
       = $7.00 + $5.50
       = $12.50
```

### 5.3 Triggers que Actualizan el Costo

```sql
TRIGGER: trigger_update_cart_shipping
ARCHIVO: TRIGGER_AUTO_CALCULAR_COSTO_ENVIO_CARRITO.sql

SE DISPARA CUANDO:
  - Cambias quantity en b2b_cart_items (INSERT/UPDATE)
  - Se actualiza el peso

ACCIÓN:
  1. Recalcula total_weight_kg del carrito (sin redondear)
  2. Llama calculate_shipping_cost_cart()
  3. Actualiza b2b_carts.shipping_cost_usd
  4. Actualiza b2b_carts.last_shipping_update

RESULTADO:
  - El carrito SIEMPRE tiene costo actualizado
  - Frontend lo ve inmediatamente via Realtime
```

---

## 🌐 PASO 6: CÓMO LLEGA AL FRONTEND

### 6.1 Flujo de Datos Frontend

```
USUARIO AGREGA PRODUCTO AL CARRITO
  ↓
API / Supabase inserta en b2b_cart_items
  ↓
TRIGGER (BD) calcula peso_kg automático
  ↓
TRIGGER (BD) recalcula b2b_carts.total_weight_kg
  ↓
TRIGGER (BD) llama calculate_shipping_cost_cart()
  ↓
TRIGGER (BD) actualiza b2b_carts.shipping_cost_usd
  ↓
Realtime de Supabase emite evento de cambio
  ↓
Hook Frontend (useCartShippingCostView) se suscribe
  ↓
Frontend recibe: {total_weight_kg: 1.5, shipping_cost: 12.50}
  ↓
UI se actualiza: "Costo de envío: $12.50"
```

### 6.2 Hooks Frontend Involucrados

**Hook 1: `useB2BCartItems` (Línea 1)**
```typescript
// Archivo: src/hooks/useB2BCartItems.ts

const { items, isLoading, refetch } = useB2BCartItems();
// items[] contiene cada item con:
//   - peso_kg: peso individual
//   - quantity: cantidad
//   - precioB2B: precio unitario
```

**Hook 2: `useCartShippingCostView` (Línea 2)**
```typescript
// Archivo: src/hooks/useCartShippingCostView.ts

const { data: cartShippingCost } = useCartShippingCostView(
  b2bSelectedIds,  // IDs de items seleccionados
  undefined,
  selectedShippingTypeId
);

// Retorna:
// {
//   total_weight_kg: 1.5,        // Peso sin redondear
//   shipping_cost: 12.50,        // Costo ya redondeado
//   estimated_days: {min: 10, max: 21}
// }
```

**Hook 3: `useB2BCartLogistics` (Línea 3)**
```typescript
// Archivo: src/hooks/useB2BCartLogistics.ts

const cartLogistics = useB2BCartLogistics(items, selectedShippingTypeId);
// Calcula logística POR ITEM (para mostrar detalles)
```

### 6.3 Consulta SQL que Recibe el Frontend

```sql
-- SQL ejecutado en el hook
SELECT 
  total_weight_kg,           -- 1.5 kg (sin redondear)
  CEIL(total_weight_kg) as rounded_weight,  -- 2 kg
  shipping_cost_usd,         -- $12.50 (ya con peso redondeado)
  last_shipping_update,
  -- ... más columnas
FROM b2b_carts
WHERE id = (SELECT cart_id FROM b2b_cart_items WHERE id IN (...))
```

---

## 🔍 RESUMEN: DÓNDE PASA CADA COSA

| Paso | Qué Ocurre | Dónde | Archivo/Función |
|------|-----------|-------|-----------------|
| 1️⃣ | **Origen de Peso** | Tablas `products` y `product_variants` | BD |
| 2️⃣ | **Peso Individual Guardado** | `b2b_cart_items.peso_kg` | TRIGGER: `calculate_cart_item_weight` |
| 3️⃣ | **Suma de Pesos (sin redondear)** | Vista: `v_cart_shipping_costs` | SQL (SELECT SUM) |
| 4️⃣ | **REDONDEO → CEIL()** | Función: `calculate_shipping_cost_cart()` | MIGRACION_COMPLETA_LOGISTICA_2026-02-10.sql |
| 5️⃣ | **Cálculo Costo** | (Peso_Redondeado × Tramo_A) + (Peso_Redondeado × Tramo_B) | `calculate_shipping_cost_cart()` |
| 6️⃣ | **Actualización BD** | `b2b_carts.shipping_cost_usd` | TRIGGER: `update_cart_shipping` |
| 7️⃣ | **Realtime** | Supabase emite evento | Realtime subscription |
| 8️⃣ | **Frontend Recibe** | Hook: `useCartShippingCostView` | `src/hooks/useCartShippingCostView.ts` |
| 9️⃣ | **UI Muestra** | SellerCartPage | `src/pages/seller/SellerCartPage.tsx` |

---

## ⚡ EJEMPLO COMPLETO: DE INICIO A FIN

```
ESCENARIO: Usuario agrega 3 items al carrito express

PASO 1: DATOS ORIGINALES
  Product A: peso_kg = 0.5 kg
  Product B: peso_kg = 0.25 kg  
  Product C: peso_kg = 0.1 kg

PASO 2: USUARIO AGREGA AL CARRITO
  b2b_cart_items INSERT:
    Item 1: product_id=A, quantity=1, (peso_kg=?)
    Item 2: product_id=B, quantity=2, (peso_kg=?)
    Item 3: product_id=C, quantity=5, (peso_kg=?)
  
  TRIGGER calcula:
    Item 1: peso_kg = 0.5 (de products.A.peso_kg)
    Item 2: peso_kg = 0.25 (de products.B.peso_kg)
    Item 3: peso_kg = 0.1 (de products.C.peso_kg)

PASO 3: CÁLCULO PESO TOTAL (sin redondeo)
  v_cart_shipping_costs calcula:
    total_weight_kg = (0.5×1) + (0.25×2) + (0.1×5)
                    = 0.5 + 0.5 + 0.5
                    = 1.5 kg  ← EXACTO

PASO 4: REDONDEO
  calculate_shipping_cost_cart() aplica CEIL:
    CEIL(1.5) = 2 kg

PASO 5: CÁLCULO DE COSTO
  Costos para "express":
    Tramo A: $3.50/kg
    Tramo B: $2.75/kg
  
  Costo = (2 × $3.50) + (2 × $2.75)
        = $7.00 + $5.50
        = $12.50

PASO 6: ACTUALIZACIÓN BD
  b2b_carts actualiza:
    total_weight_kg = 1.5       ← sin redondear
    total_weight_rounded = 2    ← redondeado
    shipping_cost_usd = 12.50
    last_shipping_update = NOW()

PASO 7: REALTIME
  Supabase emite:
    {channel: 'b2b_carts', event: 'UPDATE', ...}

PASO 8: FRONTEND RECIBE
  useCartShippingCostView retorna:
    {
      total_weight_kg: 1.5,
      shipping_cost: 12.50,
      estimated_days: {min: 10, max: 21}
    }

PASO 9: UI MUESTRA
  SellerCartPage renderiza:
    "Costo de envío: $12.50"
    "Peso total: 1.5 kg"  (opcional)
```

---

## 🛠️ DEBUGGING: ¿Por Qué No Se Actualiza?

### Checklist por Paso

```
❌ El peso_kg es NULL
  → Verificar TRIGGER está instalado
     SELECT trigger_name FROM information_schema.triggers 
     WHERE trigger_name = 'trigger_calculate_cart_item_weight';
  → Si no existe: Ejecutar TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql
  → Si existe pero sigue NULL: ejecutar ACTUALIZAR_PESO_ITEMS_AHORA.sql

❌ total_weight_kg es 0
  → Verificar peso individual está guardado
     SELECT peso_kg FROM b2b_cart_items WHERE id = '...';
  → Verificar la query de suma en v_cart_shipping_costs

❌ shipping_cost_usd sigue en $0.00
  → Verificar segundo TRIGGER está instalado
     SELECT trigger_name FROM information_schema.triggers 
     WHERE trigger_name LIKE '%update_cart_shipping%';
  → Si no existe: ejecutar TRIGGER_AUTO_CALCULAR_COSTO_ENVIO_CARRITO.sql
  → Si existe: ejecutar query manual para recalcular

❌ Frontend no ve cambio
  → Verificar Realtime subscription está activa
     Abrir DevTools → Network → buscar 'realtime'
  → Verificar hook callsCallBack se está ejecutando
     console.log en useCartShippingCostView
```

---

## 📝 QUERIES ÚTILES PARA VERIFICAR

```sql
-- 1. Ver peso de un item en carrito
SELECT id, peso_kg, quantity FROM b2b_cart_items
WHERE cart_id = 'tu-cart-id'
LIMIT 5;

-- 2. Ver cálculo de peso total
SELECT 
  cart_id,
  SUM(peso_kg * quantity) as total_weight_sin_redondear,
  CEIL(SUM(peso_kg * quantity)) as total_weight_redondeado
FROM b2b_cart_items
WHERE cart_id = 'tu-cart-id'
GROUP BY cart_id;

-- 3. Ver costo final
SELECT 
  id,
  total_weight_kg,
  shipping_cost_usd,
  last_shipping_update
FROM b2b_carts
WHERE id = 'tu-cart-id';

-- 4. Ver costos de tramos
SELECT 
  shipping_type_id,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_kg
FROM shipping_tiers
WHERE shipping_type_id = 'tu-tipo-envio';

-- 5. Ver si los triggers existen
SELECT trigger_name, event_object_table 
FROM information_schema.triggers
WHERE trigger_name LIKE '%peso%' OR trigger_name LIKE '%shipping%';

-- 6. Ver diferencia entre peso real y redondeado
SELECT 
  total_weight_kg as peso_real,
  CEIL(total_weight_kg) as peso_redondeado,
  shipping_cost_usd as costo_calculado
FROM b2b_carts
WHERE status = 'open'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🎓 CONCLUSIÓN

**El flujo es:**
1. **BD:** Peso se guarda automáticamente en cada item (TRIGGER)
2. **BD:** Se suma sin redondear (SUM en vista)
3. **BD:** Se redondea al máximo (CEIL en función)
4. **BD:** Se calcula costo con peso redondeado
5. **Frontend:** Hook consulta la vista y recibe datos
6. **Frontend:** UI muestra el costo final

**Todo ocurre automáticamente** si los triggers están instalados correctamente.

