# 🔄 Nueva Lógica: Tier Primero, Route Segundo

## ❌ Lógica Anterior (Compleja)

```
calculate_shipping_cost_cart(route_id, peso, tier_id)
```

**Flujo:**
1. Recibía `route_id` como parámetro obligatorio
2. Recibía `tier_id` opcional
3. **Validaba** que el tier perteneciera a la route
4. Si tier no pertenecía a route → rechazaba y buscaba STANDARD

**Problema:**
- Redundante: el tier YA contiene su `route_id` (FK)
- Confuso: ¿por qué pasar route si el tier ya la tiene?
- Restrictivo: no permitía usar tier de otra route

---

## ✅ Lógica Nueva (Simplificada)

```
calculate_shipping_cost_cart(peso, tier_id, route_id)
```

**Flujo:**
1. **Prioridad 1:** Si `tier_id` existe → usa ese tier
   - El tier contiene su propia `route_id` y tarifas
   - No necesita validar contra `route_id` externo
   
2. **Prioridad 2:** Si `tier_id` es NULL pero `route_id` existe
   - Busca tier "STANDARD" de esa route
   - Si no existe STANDARD → busca el primer tier activo
   
3. **Prioridad 3:** Si ambos son NULL
   - Usa valores por defecto (3.50 $/kg, 2.50 $/lb)

---

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────────────────┐
│ calculate_shipping_cost_cart(              │
│   peso,                                    │
│   tier_id,    ← Selección del usuario     │
│   route_id    ← Fallback                  │
│ )                                          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ ¿tier_id?      │
        └───┬────────┬───┘
            │ SÍ     │ NO
            ▼        ▼
    ┌───────────────────────┐    ┌──────────────────┐
    │ SELECT * FROM         │    │ ¿route_id?       │
    │ shipping_tiers        │    └───┬──────────┬───┘
    │ WHERE id = tier_id    │        │ SÍ       │ NO
    │                       │        ▼          ▼
    │ ✅ Usa:               │    ┌─────────────────┐
    │ - route_id del tier   │    │ SELECT * FROM   │
    │ - tarifas del tier    │    │ shipping_tiers  │
    └───────────────────────┘    │ WHERE route_id  │
                                 │ & tier = 'STD'  │
                                 │                 │
                                 │ ✅ Usa STANDARD │
                                 └─────────────────┘
                                        │
                                        │ fallback
                                        ▼
                                 ┌─────────────────┐
                                 │ Valores default │
                                 │ 3.50 $/kg       │
                                 │ 2.50 $/lb       │
                                 └─────────────────┘
```

---

## 🎯 Caso de Uso Real

### Escenario: Usuario selecciona "Express Shipping"

**Antes (lógica antigua):**
```sql
-- Sistema pasaba route_id del carrito Y tier seleccionado
calculate_shipping_cost_cart(
  'route-haiti',    -- Route del carrito
  2.5,              -- Peso
  'tier-express'    -- Tier seleccionado
)

-- Función validaba: ¿tier-express pertenece a route-haiti?
-- Si NO → rechazaba y usaba STANDARD
```

**Ahora (lógica nueva):**
```sql
-- Sistema pasa tier seleccionado primero
calculate_shipping_cost_cart(
  2.5,              -- Peso
  'tier-express',   -- Tier seleccionado (contiene su route)
  'route-haiti'     -- Route (ignorado porque tier existe)
)

-- Función usa directamente tier-express
-- No importa si la route coincide o no
-- El tier define todo: ruta Y tarifas
```

---

## 💡 Ventajas

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Parámetros** | route obligatorio, tier opcional | peso obligatorio, ambos opcionales |
| **Validación** | Validaba tier vs route | El tier ES la fuente de verdad |
| **Lógica** | Compleja con validación cruzada | Simple: tier → route → defaults |
| **Flexibilidad** | Restrictiva (tier debe match route) | Flexible (tier define todo) |
| **Claridad** | Confusa (¿por qué pasar route si tier la tiene?) | Intuitiva (usuario selecciona tier) |

---

## 📝 Orden de Parámetros

### ✅ NUEVO (correcto)
```sql
calculate_shipping_cost_cart(
  p_total_weight_kg NUMERIC,          -- 1. Peso (obligatorio)
  p_shipping_type_id UUID DEFAULT NULL, -- 2. Tier (define todo)
  p_route_id UUID DEFAULT NULL,        -- 3. Route (fallback)
  p_is_oversize BOOLEAN DEFAULT FALSE,
  ...
)
```

### ❌ ANTERIOR (obsoleto)
```sql
calculate_shipping_cost_cart(
  p_route_id UUID,                     -- Route primero
  p_total_weight_kg NUMERIC,
  p_shipping_type_id UUID DEFAULT NULL,
  ...
)
```

---

## 🔄 Funciones Actualizadas

Todas estas funciones ahora usan el nuevo orden:

1. ✅ **`calculate_shipping_cost_cart`**
   - Función base con nueva lógica
   
2. ✅ **`calculate_shipping_cost_for_selected_items`**
   - Lee route del carrito
   - Busca tier STANDARD
   - Llama a calculate_shipping_cost_cart(peso, tier, route)
   
3. ✅ **`get_user_cart_shipping_cost`**
   - Lee route del carrito del usuario
   - Busca tier STANDARD si no hay selección
   - Llama a calculate_shipping_cost_cart(peso, tier, route)

---

## 🎯 Ejecutar Cambios

```bash
# Ejecutar este archivo en Supabase SQL Editor:
UPDATE_CALCULATE_SHIPPING_COST_CART_TIER_FIRST.sql
```

**Incluye:**
- ✅ 3 funciones actualizadas
- ✅ Tests de verificación
- ✅ Comentarios explicativos
- ✅ Resumen de cambios
