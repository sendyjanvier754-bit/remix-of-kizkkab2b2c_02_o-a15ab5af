# ✅ LÓGICA SIMPLIFICADA: Tier Obligatorio, Sin Fallbacks

## 🎯 Cambio Final

**Usuario DEBE seleccionar tipo de envío explícitamente. Si NO selecciona → NO mostrar costo.**

## ❌ ANTES (con fallbacks)

```
Usuario abre carrito
  ↓
¿Seleccionó tier?
  NO → Buscar "STANDARD" automáticamente
  NO hay "STANDARD" → Buscar primer tier de la ruta
  NO hay tiers → Usar valores por defecto ($3.50/kg, $2.50/lb)
  ↓
Mostrar costo $XX.XX
```

**Problema:** Usuario ve costos sin haber seleccionado método de envío

---

## ✅ AHORA (tier obligatorio)

```
Usuario abre carrito
  ↓
¿Seleccionó tier?
  NO → Mostrar mensaje: "Selecciona tipo de envío"
  SÍ → Calcular con ese tier específico
  ↓
Mostrar costo $XX.XX
```

**Ventaja:** Usuario debe elegir conscientemente su método de envío

---

## 📋 Funciones Actualizadas

### 1. `calculate_shipping_cost_cart`

**Firma anterior:**
```sql
calculate_shipping_cost_cart(
  p_route_id UUID,
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID DEFAULT NULL,
  ...
)
```

**Firma nueva:**
```sql
calculate_shipping_cost_cart(
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID,  -- ✅ OBLIGATORIO (sin DEFAULT NULL)
  p_is_oversize BOOLEAN DEFAULT FALSE,
  ...
)
RETURNS TABLE (
  weight_rounded_kg NUMERIC,
  base_cost NUMERIC,
  oversize_surcharge NUMERIC,
  dimensional_surcharge NUMERIC,
  extra_cost NUMERIC,
  total_cost_with_type NUMERIC,
  shipping_type_name VARCHAR,
  shipping_type_display VARCHAR,
  volume_m3 NUMERIC,
  route_id UUID  -- ✅ Retorna route_id del tier
)
```

**Lógica:**
```sql
IF p_shipping_type_id IS NULL THEN
  RAISE EXCEPTION 'shipping_type_id es obligatorio';
END IF;

SELECT route_id, tier_name, tarifas
FROM shipping_tiers
WHERE id = p_shipping_type_id AND is_active = TRUE;

IF NOT FOUND THEN
  RAISE EXCEPTION 'Tier no encontrado o inactivo';
END IF;

-- Calcular costo con las tarifas del tier
```

---

### 2. `calculate_shipping_cost_for_selected_items`

**Cambio:**
```sql
-- ANTES
IF p_shipping_type_id IS NULL THEN
  -- Buscar STANDARD...
  -- Buscar primer tier...
END IF;

-- AHORA
IF p_shipping_type_id IS NULL THEN
  RETURN json_build_object(
    'shipping_cost', null,
    'message', 'no_shipping_type_selected',
    'error', 'El usuario debe seleccionar un tipo de envío'
  );
END IF;
```

**Llamada a calculate_shipping_cost_cart:**
```sql
-- ANTES
FROM calculate_shipping_cost_cart(
  v_route_id,      -- Route primero
  v_total_weight,
  v_shipping_type_id,
  FALSE, NULL
)

-- AHORA
FROM calculate_shipping_cost_cart(
  v_total_weight,      -- Peso primero
  p_shipping_type_id,  -- Tier obligatorio
  FALSE                -- oversize
)
```

---

### 3. `get_user_cart_shipping_cost`

**Cambio:**
```sql
-- ANTES
IF p_shipping_type_id IS NULL THEN
  -- Buscar STANDARD de la ruta
  -- Si no hay, buscar primer tier
END IF;

-- AHORA
IF p_shipping_type_id IS NULL THEN
  RETURN json_build_object(
    'shipping_cost', null,
    'message', 'no_shipping_type_selected',
    'error', 'El usuario debe seleccionar un tipo de envío'
  );
END IF;
```

**Llamada a calculate_shipping_cost_cart:**
```sql
-- ANTES
FROM calculate_shipping_cost_cart(
  v_route_id,
  v_total_weight,
  p_shipping_type_id,
  v_has_oversize,
  v_max_length, v_max_width, v_max_height
)

-- AHORA
FROM calculate_shipping_cost_cart(
  v_total_weight,
  p_shipping_type_id,  -- Obligatorio
  v_has_oversize,
  v_max_length, v_max_width, v_max_height
)
```

---

## 📦 Archivos Actualizados

✅ **FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql**
- Función base con tier obligatorio
- Tests incluidos

✅ **UPDATE_CALCULATE_SHIPPING_COST_CART_TIER_FIRST.sql**
- 3 funciones actualizadas en un solo archivo
- Listo para ejecutar completo

✅ **FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS_USE_CART_ROUTE.sql**
- Eliminados fallbacks
- Validación de tier obligatorio

✅ **FIX_GET_USER_CART_SHIPPING_COST_USE_CART_ROUTE.sql**
- Eliminados fallbacks
- Validación de tier obligatorio

---

## 🔄 Flujo de Datos Actualizado

```
┌─────────────────────────────────────┐
│ Usuario en Carrito                  │
└────────────────┬────────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ ¿Seleccionó tipo de envío? │
    └───┬────────────────┬───────┘
        │ NO             │ SÍ
        ▼                ▼
┌───────────────────┐  ┌────────────────────────────┐
│ Mostrar mensaje:  │  │ Llamar función con tier_id │
│ "Selecciona tipo  │  └────────┬───────────────────┘
│  de envío"        │           │
│                   │           ▼
│ shipping_cost:    │  ┌────────────────────────────┐
│ null              │  │ SELECT * FROM              │
│                   │  │ shipping_tiers             │
│ error:            │  │ WHERE id = tier_id         │
│ "Debe seleccionar"│  └────────┬───────────────────┘
└───────────────────┘           │
                                ▼
                       ┌────────────────────────────┐
                       │ Obtener:                   │
                       │ - route_id (del tier)      │
                       │ - tramo_a_cost_per_kg      │
                       │ - tramo_b_cost_per_lb      │
                       └────────┬───────────────────┘
                                │
                                ▼
                       ┌────────────────────────────┐
                       │ Calcular costo:            │
                       │ peso × tarifa              │
                       │ + surcharges               │
                       └────────┬───────────────────┘
                                │
                                ▼
                       ┌────────────────────────────┐
                       │ Retornar:                  │
                       │ {                          │
                       │   shipping_cost: $XX.XX,   │
                       │   route_id: uuid,          │
                       │   tier_name: "Express"     │
                       │ }                          │
                       └────────────────────────────┘
```

---

## 🧪 Respuestas Esperadas

### Sin tier seleccionado
```json
{
  "shipping_cost": null,
  "total_items": 5,
  "total_weight_kg": 2.5,
  "message": "no_shipping_type_selected",
  "error": "El usuario debe seleccionar un tipo de envío"
}
```

### Con tier seleccionado
```json
{
  "shipping_cost": 16.87,
  "weight_rounded_kg": 3,
  "base_cost": 16.87,
  "extra_cost": 0,
  "shipping_type_name": "Express",
  "shipping_type_display": "Express Shipping",
  "route_id": "21420dcb-9d8a-4947-8530-aaf3519c9047",
  "message": "calculated_from_shipping_tiers"
}
```

---

## 🎯 Próximos Pasos

1. **Ejecutar SQL:**
   ```bash
   # Opción 1: Ejecutar archivo completo
   UPDATE_CALCULATE_SHIPPING_COST_CART_TIER_FIRST.sql
   
   # Opción 2: Ejecutar archivos individuales
   FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql
   FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS_USE_CART_ROUTE.sql
   FIX_GET_USER_CART_SHIPPING_COST_USE_CART_ROUTE.sql
   ```

2. **Frontend:**
   - Componente debe validar que haya tier seleccionado
   - Si `shipping_cost` es `null` o hay `error`: mostrar mensaje
   - No permitir checkout sin tier seleccionado

3. **Verificar:**
   - Abrir carrito sin seleccionar tier → debe mostrar mensaje
   - Seleccionar tier → debe aparecer costo
   - Cambiar tier → costo debe actualizarse
   - Items sin peso → debe retornar error o $0

---

## 📊 Comparación

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Tier NULL** | Busca STANDARD automático | Error/mensaje |
| **Fallbacks** | 3 niveles (STANDARD → primero → defaults) | Ninguno |
| **route_id** | Parámetro obligatorio | Obtenido del tier |
| **Experiencia** | Confusa (ve costo sin elegir) | Clara (debe elegir) |
| **Parámetros** | `(route, peso, tier)` | `(peso, tier)` |
| **Validación** | Validaba tier vs route | Tier define todo |

---

## ✅ Resumen

**Un solo principio: El usuario selecciona el tipo de envío, el tier contiene todo lo demás (ruta + tarifas).**

Sin tier → sin costo. Simple.
