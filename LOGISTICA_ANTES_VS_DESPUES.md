# Comparativa: Antes vs Después de la Nueva Lógica de Logística

**Fecha:** 2026-02-10

## Panel de Negocio

### ANTES (v_business_panel_data antigua)
```typescript
import { useBusinessPanelData } from '@/hooks/useBusinessPanelData';

const { data } = useBusinessPanelData(productId);
```

**Cálculo en SQL:**
```sql
-- Vista v_business_panel_data (antigua)
SELECT
  shipping_cost_per_unit = (
    weight_kg * tramo_a_cost
    + weight_kg * 2.20462 * tramo_b_cost
    + zone_surcharge
  ),
  ...
FROM v_logistics_data ld
JOIN v_productos_con_precio_b2b vp
```

**Problema:**
- Cálculo manual de costos en SQL (hardcoded)
- No usaba funciones calculadas
- Zona surcharge incluida siempre ($5.00)
- Difícil de cambiar o escalar

---

### AHORA (v_business_panel_with_shipping_functions)
```typescript
import { useBusinessPanelDataWithShipping } from '@/hooks/useBusinessPanelDataWithShipping';

const { data } = useBusinessPanelDataWithShipping(productId);
// Exactamente el mismo formato de props, pero con datos nuevos
```

**Cálculo en SQL:**
```sql
-- Vista v_business_panel_with_shipping_functions (nueva)
SELECT
  shipping_cost_per_unit = (
    SELECT base_cost FROM calculate_shipping_cost(
      route_id,
      weight_kg
    )
  ),
  ...
```

**Ventajas:**
✅ Usa función SQL `calculate_shipping_cost()`  
✅ Lógica única y reutilizable  
✅ Fácil de mantener y actualizar  
✅ Consistente con carrito  
✅ Preparado para múltiples rutas  

---

## Módulo de Categoría

### ANTES
**No había integración específica**
- Cada componente calculaba su propio costo
- Posibles inconsistencias
- Difícil de mantener

---

### AHORA
```typescript
import { useCategoryLogisticsBatch } from '@/hooks/useCategoryLogistics';

const { itemMap } = useCategoryLogisticsBatch(productIds);

// En cada card:
const item = itemMap.get(productId);
const finalPrice = item.precio + item.shipping_cost;
```

**View que lo soporta:**
```sql
-- v_category_logistics
SELECT
  product_id,
  shipping_cost = (
    SELECT base_cost FROM calculate_shipping_cost(
      route_id, weight_kg
    )
  ),
  ...
FROM products
```

**Ventajas:**
✅ Datos unificados por hook  
✅ Performance: batch query  
✅ Costos consistentes en listados  
✅ Peso visible para usuarios  

---

## Carrito e Checkout

### ANTES (useShippingCostCalculationForCart)
```typescript
const { result } = useShippingCostCalculationForCart(cartItems);

// Retorna:
// - totalWeight_kg: suma real sin redondear
// - totalCost: costo calculado
// - itemCosts: distributed por peso ratio
```

**Proceso:**
```
1. Fetch weights de cada item
2. Sumar pesos sin redondear
3. Redondear con CEIL
4. Calcular costo TOTAL = (ceil_weight × tramo_a) + (ceil_weight × 2.20462 × tramo_b) + zone_surcharge
5. Distribuir proporcional a items
```

**Limitaciones:**
- ❌ No soporta tipos de envío (STANDARD/EXPRESS/PRIORITY)
- ❌ No calcula surcharges
- ❌ Distribución proporcional (confuso para usuario)
- ❌ Zone surcharge siempre incluido

---

### AHORA (useCartShippingCost + calculate_shipping_cost_cart)

```typescript
const { summary, totalWeight, updateShippingType } = useCartShippingCost(
  cartItems,
  routeId,
  selectedShippingTypeId  // NEW: Soporte para tipos
);

// Retorna:
// - weight_rounded_kg: 0.700 → 1.0
// - base_cost: $14.52
// - extra_cost: $2.00 (si EXPRESS)
// - total_cost_with_type: $16.52
// - shipping_type_display: "Envío Express"
```

**Proceso:**
```
1. Sumar pesos sin redondear
2. Llamar a calculate_shipping_cost_cart(route_id, total, type_id)
3. Función retorna:
   - Redondeo CEIL automático
   - Costo base
   - Surcharge del tipo
   - Total final
4. Usuario ve exactamente lo que paga
```

**Mejoras:**
✅ Tipos de envío con surcharges  
✅ Costo total transparente (no distribuido)  
✅ Dinámico: puede cambiar tipo sin recalcular items  
✅ Nueva RPC function: `calculate_shipping_cost_cart()`  
✅ Surcharge visible (fijo + porcentaje)  

---

## Comparativa por Contexto

### Scenario 1: Producto Individual

**ANTES:**
```
Camiseta (0.300 kg)
- Costo base calculado: $2.21 (sin surcharge)
- NO había tipos de envío
```

**AHORA:**
```
Camiseta (0.300 kg)
- Hook: useShippingTypes(routeId)
- Tipos disponibles: STANDARD, EXPRESS, PRIORITY
- Costo base: $2.21
- Con EXPRESS: $2.21 + $2.00 = $4.21
- Con PRIORITY: $2.21 × 1.10 = $2.43
```

---

### Scenario 2: Carrito (2+ Items)

**ANTES:**
```
Input: 0.300 + 0.400 = 0.700 kg
↓
CEIL(0.700) = 1.0 kg
↓
Base = 1.0 × $3.50 + 1.0 × 2.20462 × $5.00 + $5.00 = $19.52
↓
Distribuir: Camiseta $11 aprox, Tanga $8 aprox (confuso)
```

**AHORA:**
```
Input: [0.300 kg, 0.400 kg] + tipo: EXPRESS
↓
RPC: calculate_shipping_cost_cart(routeId, 0.700, expressTypeId)
↓
Output:
- weight_rounded_kg: 1.0
- base_cost: $14.52  ← SIN zone surcharge
- extra_cost: $2.00
- total: $16.52
↓
Usuario ve claro: "Base $14.52 + Express $2.00 = $16.52"
```

---

## RPC Functions Nuevas

### calculate_shipping_cost(route_id, weight_kg)
```sql
RETURNS:
- weight_kg: Peso original
- base_cost: Costo = (weight × tramo_a) + (weight × 2.20462 × tramo_b)

Uso: Para productos individuales
Ejemplo: 0.300 kg → $2.21
```

### calculate_shipping_cost_cart(route_id, total_weight_kg, shipping_type_id)
```sql
RETURNS:
- weight_rounded_kg: CEIL(total_weight_kg)
- base_cost: Costo del peso redondeado
- extra_cost: Surcharge del tipo
- total_cost_with_type: Base + Extra
- shipping_type_display: Nombre del tipo

Uso: Para carrito con surcharge
Ejemplo: 0.700 kg + EXPRESS → weights: 1.0, base: $14.52, extra: $2.00, total: $16.52
```

---

## Cambios en Base de Datos

### Tablas Nuevas
```sql
CREATE TABLE shipping_type_configs (
  id UUID PRIMARY KEY,
  route_id UUID FK → shipping_routes,
  type VARCHAR (STANDARD, EXPRESS, PRIORITY),
  extra_cost_fixed NUMERIC ($ fijo),
  extra_cost_percent NUMERIC (% extra),
  display_name VARCHAR
)
-- INSERT: 3 tipos (STANDARD, EXPRESS, PRIORITY)
```

### Vistas Nuevas
```
✅ v_business_panel_with_shipping_functions
   - Para panel de negocio
   - Usa calculate_shipping_cost()

✅ v_category_logistics
   - Para módulo de categoría
   - Usa calculate_shipping_cost()

✅ v_business_panel_cart_summary
   - Para carrito (referencial)
   - Info básica + route_id
```

### Funciones Nuevas
```
✅ calculate_shipping_cost(route_id, weight_kg)
   - Para productos individuales
   - Peso real, sin redondeo

✅ calculate_shipping_cost_cart(route_id, total_weight_kg, type_id)
   - Para carrito
   - Redondea a superior, aplica surcharge
```

---

## Resumen de Cambios

| Aspecto | Antes | Después |
|---|---|---|
| **Cálculo Costos** | Manual en SQL | Función SQL (`calculate_shipping_cost`) |
| **Tipos de Envío** | No soportado | ✅ STANDARD, EXPRESS, PRIORITY |
| **Surcharges** | No | ✅ Fijo + Porcentaje |
| **Redondeo Peso** | A nivel item | ✅ Solo total del carrito |
| **Zona Surcharge** | Siempre $5.00 | Removido (opcional en tipo) |
| **Panel Negocio** | `v_business_panel_data` (antigua) | `v_business_panel_with_shipping_functions` (nueva) |
| **Categoría** | Sin integración | ✅ `v_category_logistics` |
| **Carrito** | `useShippingCostCalculationForCart` | ✅ `useCartShippingCost` + `calculate_shipping_cost_cart` RPC |
| **Transparencia** | Distribuido proporcional | ✅ Total exacto + desglose |
| **Múltiples Rutas** | Hardcoded China→Haití | ✅ Parametrizable por route_id |

---

## Impacto en Componentes

### Components Que Necesitan Update

1. **SellerCartPage**
   - Import: `useBusinessPanelDataWithShipping` en lugar de `useBusinessPanelData`
   - No cambiar layout ni lógica, solo el hook

2. **CategoryPage / CategoryCard**
   - Import: `useCategoryLogisticsBatch`
   - Mostrar shipping_cost en precio final

3. **CheckoutPage**
   - Reemplazar: `useShippingCostCalculationForCart` → `useCartShippingCost`
   - Agregar: Selector de tipo de envío
   - Mostrar: Weight + surcharge breakdown

4. **CartSummary**
   - Nueva información: Peso redondeado visible
   - Nuevo campo: Surcharge detail

---

## Migration Path

**Fase 1 (Ya Completada):**
- ✅ `useShippingTypes` hook creado
- ✅ `calculate_shipping_cost()` RPC creado
- ✅ `calculate_shipping_cost_cart()` RPC creado
- ✅ `shipping_type_configs` tabla creada
- ✅ 3 tipos de envío insertados

**Fase 2 (Just Completed):**
- ✅ `v_business_panel_with_shipping_functions` vista creada
- ✅ `v_category_logistics` vista creada
- ✅ `v_business_panel_cart_summary` vista creada
- ✅ `useBusinessPanelDataWithShipping` hook creado
- ✅ `useCategoryLogistics` hook creado
- ✅ `useCartShippingCost` hook creado

**Fase 3 (Por Usuario - Integration):**
- [ ] Execute migrations en Supabase
- [ ] Update SellerCartPage imports
- [ ] Update CategoryPage/Card imports
- [ ] Update CheckoutPage/CartPage imports
- [ ] Test: Panel negocio
- [ ] Test: Categoría
- [ ] Test: Carrito
- [ ] Deploy

---

**Actualizado:** 2026-02-10  
**Status:** ✅ ARQUITECTURA LISTA PARA INTEGRACIÓN
