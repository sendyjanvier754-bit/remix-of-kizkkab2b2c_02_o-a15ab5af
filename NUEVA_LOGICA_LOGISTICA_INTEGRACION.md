# Nueva Lógica de Logística - Guía de Integración

## 📋 Componentes Creados (2026-02-10)

### SQL - Nuevas Vistas Creadas

#### 1. `v_business_panel_with_shipping_functions`
**Ubicación:** `20260210_business_panel_with_new_shipping_logic.sql`

Panel de negocio que usa `calculate_shipping_cost()` para cada producto/variante.

**Campos:**
```
- product_id, variant_id: IDs del item
- item_name, sku, item_type: Identificadores
- cost_per_unit: Precio B2B
- weight_kg: Peso real SIN redondear
- shipping_cost_per_unit: Costo calculado con función (peso real)
- suggested_pvp_per_unit: Precio sugerido = (precio × 2.5) + costo envío
- investment_1unit, revenue_1unit: Valores por unidad
- profit_1unit, margin_percentage: Análisis de ganancia
```

**Ventajas:**
- Costos 100% consistentes con carrito
- Usa función SQL calculada
- Peso real sin redondeo en item level

---

#### 2. `v_category_logistics`
**Ubicación:** `20260210_business_panel_with_new_shipping_logic.sql`

Datos simplificados de logística para módulo de categoría.

**Campos:**
```
- product_id, variant_id: IDs
- item_name: Nombre completo
- weight_kg: Peso real
- shipping_cost: Costo de envío (peso real)
- is_active: Estado
```

**Uso:** Mostrar en listados de categoría, búsqueda, filtrados por precio+envío

---

#### 3. `v_business_panel_cart_summary`
**Ubicación:** `20260210_business_panel_cart_summary.sql`

Datos básicos con ruta asignada para el carrito.

**Campos:**
```
- product_id, variant_id: IDs
- cost_per_unit: Precio B2B
- weight_kg: Peso real
- route_id: ID de ruta asignada
```

**Nota:** Esta vista es referencial. El cálculo real del carrito se hace con la función RPC `calculate_shipping_cost_cart()` que suma todos los pesos y redondea el total.

---

### React - Nuevos Hooks

#### 1. `useBusinessPanelDataWithShipping`
**Ubicación:** `src/hooks/useBusinessPanelDataWithShipping.ts`

Obtiene datos del panel de negocio con costos de envío calculados.

**Uso Individual:**
```typescript
const MyComponent = ({ productId }) => {
  const { data, isLoading, error } = useBusinessPanelDataWithShipping(
    productId,
    variantId // opcional
  );

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>{data?.item_name}</h2>
      <p>Peso: {data?.weight_kg} kg</p>
      <p>Costo envío: ${data?.shipping_cost_per_unit}</p>
      <p>PVP sugerido: ${data?.suggested_pvp_per_unit}</p>
      <p>Ganancia: ${data?.profit_1unit} ({data?.margin_percentage}%)</p>
    </div>
  );
};
```

**Uso en Batch (Para múltiples items):**
```typescript
const items = [
  { productId: 'prod-1' },
  { productId: 'prod-2', variantId: 'var-1' }
];

const { dataMap, isLoading } = useBusinessPanelDataWithShippingBatch(items);

// Acceder a datos
const product1Data = dataMap.get('prod-1');
const variant1Data = dataMap.get('prod-2-var-1');
```

---

#### 2. `useCategoryLogistics`
**Ubicación:** `src/hooks/useCategoryLogistics.ts`

Obtiene datos de logística para módulo de categoría.

**Obtener Todos los Activos:**
```typescript
const { items, isLoading } = useCategoryLogistics();

return (
  <div>
    {items.map(item => (
      <div key={item.product_id}>
        <h3>{item.item_name}</h3>
        <p>Peso: {item.weight_kg} kg</p>
        <p>Envío: ${item.shipping_cost}</p>
      </div>
    ))}
  </div>
);
```

**Obtener Item Específico:**
```typescript
const { item } = useCategoryLogisticsItem(
  productId,
  variantId // opcional
);
```

**Obtener Múltiples (Para Listados):**
```typescript
const productIds = ['prod-1', 'prod-2', 'prod-3'];
const { itemMap } = useCategoryLogisticsBatch(productIds);

// Acceder
const cost = itemMap.get('prod-1')?.shipping_cost;
```

---

#### 3. `useShippingTypes`
**Ubicación:** `src/hooks/useShippingTypes.ts`

Gestiona tipos de envío y cálculo de costos con surcharges.

```typescript
const { 
  shippingTypes,      // Array de tipos disponibles
  selectedTypeId,     // ID del tipo seleccionado
  selectedType,       // Objeto completo del tipo
  setSelectedTypeId,  // Cambiar tipo
  calculateProductCost,  // Para productos individuales
  calculateCartCost      // Para carrito con sumcharge
} = useShippingTypes(routeId);

// Seleccionar tipo (EXPRESS = +$2.00)
setSelectedTypeId(expressTypeId);

// Calcular costo para producto individual
const productCost = await calculateProductCost(0.300); // 0.300 kg
// Retorna: { weight_kg: 0.300, base_cost: 2.21 }

// Calcular carrito con surcharge
const cartCost = await calculateCartCost(
  0.700,        // Total sin redondear (3 items)
  expressTypeId // Con EXPRESS
);
// Retorna: {
//   weight_rounded_kg: 1.0,           // Redondeado a superior
//   base_cost: 14.52,
//   extra_cost: 2.00,                 // Surcharge de EXPRESS
//   total_cost_with_type: 16.52,
//   shipping_type_display: "Envío Express"
// }
```

---

#### 4. `useCartShippingCost`
**Ubicación:** `src/hooks/useCartShippingCost.ts`

Calcula costos de carrito con redondeo de peso y surcharges de tipos.

```typescript
const cartItems = [
  { product_id: 'prod-1', weight_kg: 0.300, quantity: 1 },
  { product_id: 'prod-2', weight_kg: 0.400, quantity: 1 }
];

const { 
  summary,              // Resumen de costos
  totalWeight,          // 0.700 (sin redondear)
  updateShippingType,   // Cambiar tipo dinámicamente
  isLoading,
  error
} = useCartShippingCost(
  cartItems,
  '21420dcb-9d8a-4947-8530-aaf3519c9047', // routeId
  expressTypeId // opcional, tipo seleccionado
);

// Usar en componente
return (
  <div>
    <p>Peso total (sin redondear): {totalWeight} kg</p>
    <p>Peso redondeado: {summary?.weight_rounded_kg} kg</p>
    <p>Base: ${summary?.base_cost}</p>
    {summary?.extra_cost > 0 && (
      <p>Surcharge: +${summary?.extra_cost}</p>
    )}
    <h3>Total: ${summary?.total_cost_with_type}</h3>
  </div>
);

// Cambiar tipo de envío
const newSummary = await updateShippingType(priorityTypeId);
```

---

## 📊 Fórmulas de Cálculo

### Para Producto Individual (`calculate_shipping_cost`)
```
Base Cost = (weight_kg × tramo_a_per_kg) + (weight_kg × 2.20462 × tramo_b_per_lb)

Ejemplo (0.300 kg, China→Haití):
- Tramo A: 0.300 × $3.50 = $1.05
- Tramo B: 0.300 × 2.20462 × $5.00 = $3.31
- Total: $4.36
```

### Para Carrito (`calculate_shipping_cost_cart`)
```
1. Sumar pesos SIN redondear: 0.300 + 0.400 = 0.700 kg
2. Redondear a superior (CEIL): 0.700 → 1.0 kg
3. Calcular base: 1.0 × $3.50 + 1.0 × 2.20462 × $5.00 = $14.52
4. Si tipo seleccionado (ej. EXPRESS: +$2.00):
   - Extra Cost = $2.00 (fijo) + 0% (porcentaje)
   - Total = $14.52 + $2.00 = $16.52
```

### Tipos de Envío (Surcharges)
```
- STANDARD: $0 fijo, 0% extra
- EXPRESS: $2.00 fijo, 0% extra
- PRIORITY: $0 fijo, 10% extra

Ejemplo PRIORITY con base $14.52:
- Extra = $0 + ($14.52 × 10 / 100) = $1.45
- Total = $14.52 + $1.45 = $15.97
```

---

## 🔌 Integración: Paso a Paso

### 1. Panel de Negocio (SellerCartPage)
**Cambio:**
```typescript
// ANTES:
import { useBusinessPanelData } from '@/hooks/useBusinessPanelData';
const { data } = useBusinessPanelData(productId, variantId);

// AHORA:
import { useBusinessPanelDataWithShipping } from '@/hooks/useBusinessPanelDataWithShipping';
const { data } = useBusinessPanelDataWithShipping(productId, variantId);
// Exactamente igual pero con costos calculados por función
```

### 2. Módulo de Categoría
```typescript
// En componente de categoría
const { itemMap } = useCategoryLogisticsBatch(productIds);

// En card de producto
const logistics = itemMap.get(productId);
return (
  <Card>
    <Price>${price + logistics?.shipping_cost}</Price>
  </Card>
);
```

### 3. Carrito/Checkout
```typescript
// En componente de carrito
const { summary, totalWeight } = useCartShippingCost(
  cartItems,
  routeId,
  selectedShippingTypeId
);

// Mostrar desglose
return (
  <Summary>
    <WeightInfo>
      Real: {totalWeight} kg
      Redondeado: {summary?.weight_rounded_kg} kg
    </WeightInfo>
    <CostBreakdown>
      Base: ${summary?.base_cost}
      {summary?.extra_cost > 0 && (
        <>Surcharge: +${summary?.extra_cost}</>
      )}
      Total: ${summary?.total_cost_with_type}
    </CostBreakdown>
  </Summary>
);
```

---

## ✅ Checklist de Integración

- [x] Crear vistas SQL (3 vistas)
- [x] Crear hooks React (4 hooks principales)
- [ ] Pruebas unitarias de hooks
- [ ] Integrar en SellerCartPage (BusinessPanel)
- [ ] Integrar en módulo de categoría
- [ ] Integrar en checkout/carrito
- [ ] Pruebas end-to-end
- [ ] Actualizar documentación existente

---

## 🐛 Debugging

### Verificar que las funciones existen
```sql
-- En Supabase SQL Editor
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE 'calculate_shipping%';

-- Resultado esperado:
-- - calculate_shipping_cost
-- - calculate_shipping_cost_cart
```

### Verificar que las vistas existen
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_type = 'VIEW' 
  AND table_name LIKE 'v_%shipping%' 
  OR table_name LIKE 'v_business%' 
  OR table_name LIKE 'v_category%';
```

### Prueba de función SQL
```sql
-- Probar calculate_shipping_cost()
SELECT * FROM public.calculate_shipping_cost(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.400
);

-- Resultado esperado:
-- weight_kg: 0.4
-- base_cost: 14.52

-- Probar calculate_shipping_cost_cart()
SELECT * FROM public.calculate_shipping_cost_cart(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.700,
  NULL
);

-- Resultado esperado:
-- weight_rounded_kg: 1.0
-- base_cost: 14.52
-- extra_cost: 0.00
-- total_cost_with_type: 14.52
```

---

## 📝 Notas Importantes

1. **Peso Real vs Redondeado:**
   - Productos individuales: Peso real (sin redondear)
   - Carrito: Suma sin redondear, redondea el total a superior con CEIL
   - Esto es importante para el costo final

2. **Ruta Predeterminada:**
   - UUID: `'21420dcb-9d8a-4947-8530-aaf3519c9047'` (China → Haití)
   - Usada en todas las vistas como fallback
   - Si cambias la ruta, actualizar en SQL

3. **Tipos de Envío:**
   - Información en tabla `shipping_type_configs`
   - Usados para aplicar surcharges
   - El hook `useShippingTypes` los gestiona

4. **Performance:**
   - Las vistas usan JOINs complejos con funciones
   - Considerar índices adicionales en producción
   - Usar batch methods cuando sea posible

---

## 🔗 Referencias

- **Anterior:** `20260209_fix_bulk_weight_rounding.sql` (v_business_panel_data antigua)
- **Nueva Migración 1:** `20260210_business_panel_with_new_shipping_logic.sql`
- **Nueva Migración 2:** `20260210_business_panel_cart_summary.sql`
- **SQL Functions:** `20260210_shipping_types_linked_to_routes.sql` (create [calculate_shipping_cost](vscode-file://vscode-app/c:/Users/STAVE%20RICHARD%20DORVIL/kizkkab2b2c), calculate_shipping_cost_cart)
- **Hook Existente:** `src/hooks/useShippingTypes.ts`

---

Creado: 2026-02-10
Autor: Sistema de Logística B2B
Versión: 1.0
