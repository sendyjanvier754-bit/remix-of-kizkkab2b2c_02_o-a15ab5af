# 🏗️ ARQUITECTURA SEPARADA: Precio vs Logística

**Fecha:** 31-01-2026  
**Estado:** ✅ Implementado  
**Objetivo:** Motores independientes unificados en checkout

---

## 📊 Estructura

```
┌─────────────────────────────────────────────────────────────┐
│                    CHECKOUT (Orquestador)                    │
│              useCheckoutCalculator.ts                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────┐       │
│  │ MOTOR DE PRECIO  │    │ MOTOR DE LOGÍSTICA       │       │
│  │                  │    │                          │       │
│  │ useB2B           │    │ useLogisticsEngine       │       │
│  │ PricingEngine    │    │                          │       │
│  │                  │    │ • Calcula costo por kg   │       │
│  │ • Precio base    │    │ • Retorna desglose       │       │
│  │ • Márgenes       │    │ • Tiempo estimado        │       │
│  │ • Fees (12%)     │    │                          │       │
│  └──────────────────┘    └──────────────────────────┘       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    BD: Vistas SQL                            │
│                                                              │
│  • v_productos_precio_base       (Precios sin logística)   │
│  • v_rutas_logistica             (Rutas sin precios)       │
│  • v_checkout_summary            (Helper de checkout)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Base de Datos

### 1. Función: `calculate_base_price_only()`
```sql
-- INPUT: product_id, margin_percent
-- OUTPUT: precio_base (sin logística)

SELECT calculate_base_price_only(product_id, 30) AS precio_base;
-- Retorna: costo_fabrica + margen (30%) + fees (12%)
```

### 2. Función: `calculate_route_cost()`
```sql
-- INPUT: route_id, weight_kg, weight_cbm
-- OUTPUT: JSONB con desglose COMPLETO + ETA

SELECT calculate_route_cost(route_id, 5.0, 0.1) AS logistics;
-- Retorna: {
--   "total_cost": 150.00,
--   "tramo_a_china_to_hub": 100.00,
--   "tramo_b_hub_to_destination": 50.00,
--   "estimated_days_min": 10,
--   "estimated_days_max": 15,
--   "eta_date_min": "2026-02-10",    ← FECHA ESTIMADA MÍNIMA
--   "eta_date_max": "2026-02-15"     ← FECHA ESTIMADA MÁXIMA
-- }
```

### 3. Vista: `v_productos_precio_base`
```sql
SELECT *
FROM v_productos_precio_base
WHERE categoria_id = '...';

-- Retorna SOLO precio (sin logística):
-- id, sku, nombre, costo_fabrica, precio_base, margin, fees, ...
```

### 4. Vista: `v_productos_con_precio_b2b` (AHORA SOLO PRECIO)
```sql
SELECT *
FROM v_productos_con_precio_b2b
WHERE categoria_id = '...';

-- ✅ ACTUALIZADO: Ahora es idéntico a v_productos_precio_base
-- Contiene SOLO el precio base (sin logística)
-- La logística se calcula aparte con calculate_route_cost()
```

### 4. Vista: `v_rutas_logistica`
```sql
SELECT *
FROM v_rutas_logistica
WHERE country_code = 'HT';

-- Retorna:
-- route_id, destination, hub, segment_a, segment_b, ...
```

---

## 💻 Frontend: Hooks

### Hook 1: `useB2BPricingEngine`
```typescript
const { 
  productsWithBasePrice,      // Array de productos con precio_base
  getProductBasePrice,        // Obtener precio de un producto
  getProductsByCategory,      // Filtrar por categoría
  getPriceBreakdown,          // Desglose: costo + margen + fee
  formatPrice,                // Formatear para UI
} = useB2BPricingEngine();

// Uso
const product = await getProductBasePrice('prod-123');
console.log(product.precio_base);  // 456.78

const breakdown = getPriceBreakdown(product);
// {
//   costo_fabrica: 100.00,
//   margen_aplicado: 30.00,
//   fee_plataforma: 15.60,
//   precio_base: 145.60
// }
```

### Hook 2: `useLogisticsEngine`
```typescript
const {
  routes,                     // Array de rutas disponibles
  calculateLogisticsCost,     // Calcular costo por ruta
  getRoutesByCountry,         // Filtrar por país
  getEstimatedDays,           // Tiempo de entrega
  getLowestCostRoute,         // Ruta más barata
} = useLogisticsEngine();

// Uso
const logistics = await calculateLogisticsCost(
  'route-456',  // route_id
  5.5,          // weight_kg
  0.1           // weight_cbm (opcional)
);

console.log(logistics);
// {
//   total_cost: 150.00,
//   tramo_a_china_to_hub: 100.00,
//   tramo_b_hub_to_destination: 50.00,
//   estimated_days_min: 10,
//   estimated_days_max: 15
// }
```

### Hook 3: `useCheckoutCalculator` (Orquestador)
```typescript
const {
  checkoutItems,
  selectedRoute,
  
  addToCheckout,
  removeFromCheckout,
  updateQuantity,
  changeRoute,
  calculateCheckoutTotal,
  getRecommendedRoutes,
  formatCheckoutSummary,
} = useCheckoutCalculator();

// Uso
// 1. Agregar producto
addToCheckout(product, quantity, routeId);

// 2. Calcular total
const summary = await calculateCheckoutTotal(checkoutItems);
console.log(summary);
// {
//   items: [...],
//   subtotalPrice: 456.78,        // Sum of prices * qty
//   logisticsCost: 150.00,        // Logistics
//   subtotal: 606.78,
//   platformFee: 72.81,           // 12% of subtotal
//   tax: 60.68,                   // 10% (configurable)
//   total: 740.27,
//   routeName: 'Haiti via Port-au-Prince',
//   estimatedDaysMin: 10,
//   estimatedDaysMax: 15
// }

// 3. Obtener rutas recomendadas
const recommended = getRecommendedRoutes();  // 3 rutas más baratas

// 4. Formatear para UI
const formatted = formatCheckoutSummary(summary);
// {
//   itemsCount: 2,
//   subtotalPrice: "$456.78",
//   logisticsCost: "$150.00",
//   total: "$740.27",
//   ...
// }
```

---

## 📦 Flujo en Checkout

```typescript
// Componente: CheckoutPage.tsx

import { useCheckoutCalculator } from '@/hooks/useCheckoutCalculator';
import { useB2BPricingEngine } from '@/hooks/useB2BPricingEngine';
import { useLogisticsEngine } from '@/hooks/useLogisticsEngine';

export function CheckoutPage() {
  const pricing = useB2BPricingEngine();
  const logistics = useLogisticsEngine();
  const checkout = useCheckoutCalculator();

  const handleAddProduct = async (productId: string) => {
    // 1. Obtener producto con precio base
    const product = await pricing.getProductBasePrice(productId);
    
    // 2. Obtener rutas recomendadas
    const routes = checkout.getRecommendedRoutes();
    
    // 3. Agregar al checkout
    checkout.addToCheckout(product, 1, routes[0]);
    
    // 4. Calcular total
    const summary = await checkout.calculateCheckoutTotal(
      checkout.checkoutItems
    );
    
    // 5. Mostrar en UI
    return summary;
  };

  return (
    <div className="checkout">
      {/* Items */}
      {checkout.checkoutItems.map(item => (
        <CheckoutItemRow key={item.product.product_id} item={item} />
      ))}

      {/* Routes */}
      <RouteSelector 
        routes={checkout.availableRoutes}
        selectedRoute={checkout.selectedRoute}
        onSelectRoute={checkout.changeRoute}
      />

      {/* Summary */}
      {checkoutSummary && (
        <CheckoutSummary summary={checkoutSummary} />
      )}
    </div>
  );
}
```

---

## 🔄 Actualizar Componentes Existentes

### Antes (Acoplado):
```typescript
// ProductCard.tsx
import { useB2BPriceCalculator } from '@/hooks/useB2BPriceCalculator';

export function ProductCard({ product }) {
  const { calculatePrice } = useB2BPriceCalculator();
  
  const price = calculatePrice(product, logistics); // ❌ Mezcla ambas
  
  return <div>${price}</div>;
}
```

### Después (Separado):
```typescript
// ProductCard.tsx
import { useB2BPricingEngine } from '@/hooks/useB2BPricingEngine';

export function ProductCard({ product }) {
  const { formatPrice } = useB2BPricingEngine();
  
  // SOLO precio, sin logística
  const price = product.precio_base;
  
  return <div>{formatPrice(price, 'USD')}</div>;
}
```

---

## 📋 Checklist de Implementación

- [ ] Aplicar migración SQL: `20260131_separate_pricing_logistics.sql`
- [ ] Verificar vistas creadas:
  - [ ] `v_productos_precio_base`
  - [ ] `v_rutas_logistica`
  - [ ] `v_checkout_summary`
- [ ] Implementar hooks:
  - [ ] `useB2BPricingEngine.ts` ✅
  - [ ] `useLogisticsEngineSeparated.ts` ✅
  - [ ] `useCheckoutCalculator.ts` ✅
- [ ] Actualizar componentes:
  - [ ] ProductCard.tsx → usar `useB2BPricingEngine`
  - [ ] CartItem.tsx → usar `useB2BPricingEngine`
  - [ ] CheckoutPage.tsx → usar `useCheckoutCalculator`
  - [ ] RouteSelector.tsx → usar `useLogisticsEngine`
- [ ] Testear cálculos de precios
- [ ] Testear cálculos de logística
- [ ] Testear totales en checkout

---

## 🧪 Testing

### Test Motor de Precio
```typescript
import { renderHook } from '@testing-library/react';
import { useB2BPricingEngine } from '@/hooks/useB2BPricingEngine';

test('should calculate base price correctly', async () => {
  const { result } = renderHook(() => useB2BPricingEngine());
  
  const product = await result.current.getProductBasePrice('prod-123');
  
  expect(product.precio_base).toBe(145.60); // costo + margen + fee
  expect(product.margin_value).toBe(30.00);
  expect(product.platform_fee).toBe(15.60);
});
```

### Test Motor de Logística
```typescript
import { renderHook } from '@testing-library/react';
import { useLogisticsEngine } from '@/hooks/useLogisticsEngineSeparated';

test('should calculate logistics cost correctly', async () => {
  const { result } = renderHook(() => useLogisticsEngine());
  
  const logistics = await result.current.calculateLogisticsCost(
    'route-456',
    5.5
  );
  
  expect(logistics.total_cost).toBe(150.00);
  expect(logistics.tramo_a_china_to_hub).toBe(100.00);
  expect(logistics.tramo_b_hub_to_destination).toBe(50.00);
});
```

### Test Checkout Calculator
```typescript
import { renderHook } from '@testing-library/react';
import { useCheckoutCalculator } from '@/hooks/useCheckoutCalculator';

test('should calculate checkout total correctly', async () => {
  const { result } = renderHook(() => useCheckoutCalculator());
  
  result.current.addToCheckout(product, 2, 'route-456');
  
  const summary = await result.current.calculateCheckoutTotal(
    result.current.checkoutItems
  );
  
  expect(summary.total).toBe(740.27);
  expect(summary.subtotalPrice).toBe(456.78);
  expect(summary.logisticsCost).toBe(150.00);
});
```

---

## 🚀 Ventajas de esta Arquitectura

| Aspecto | Beneficio |
|---------|-----------|
| **Separación** | Motor de precio ≠ Motor de logística |
| **Testabilidad** | Cada uno se testa independientemente |
| **Reutilización** | Usar motor de precio en PDP, Admin, etc. |
| **Mantenimiento** | Cambios en precio no afectan logística |
| **Escalabilidad** | Agregar nuevas reglas es fácil |
| **Debugging** | Claro dónde falló (precio o logística) |
| **Flexibilidad** | Frontend controla la composición |

---

## 📞 Próximos Pasos

1. **Aplicar migración SQL**
2. **Actualizar componentes frontend**
3. **Implementar tests**
4. **Validar en staging**
5. **Deploy a producción**

---

**Autor:** Sistema de Arquitectura  
**Última actualización:** 31-01-2026
