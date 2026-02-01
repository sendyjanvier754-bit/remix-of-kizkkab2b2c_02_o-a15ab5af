
# Plan: Corrección de Errores de Build + Continuación B2B

## Resumen

Este plan corrige los 10 errores de TypeScript actuales y prepara la base para continuar con la implementación del Motor de Precios B2B Multitramo. Los errores están relacionados con propiedades faltantes en hooks, imports incorrectos y variables no declaradas.

---

## Fase 1: Corrección de Errores (Inmediato)

### Error 1: `useSellerCatalog` falta `storeId`

**Archivos afectados:**
- `src/pages/seller/SellerInventarioB2C.tsx` (línea 19)
- `src/components/seller/SellerMarketingTools.tsx` (línea 51)

**Problema:** El hook `useSellerCatalog` no retorna `storeId`, pero es requerido por estos componentes.

**Solución:** Modificar `src/hooks/useSellerCatalog.ts` para:
1. Agregar estado `storeId`
2. Hacer query a la tabla `stores` para obtener el ID de la tienda del usuario
3. Retornar `storeId` en el objeto de retorno

```typescript
// Agregar al hook:
const [storeId, setStoreId] = useState<string | null>(null);

// En useEffect, buscar la tienda del usuario:
const { data: store } = await supabase
  .from('stores')
  .select('id')
  .eq('owner_id', user?.id)
  .single();
  
if (store) setStoreId(store.id);

// Agregar al return:
return { items, isLoading, storeId, ...resto };
```

---

### Error 2: `getStats()` falta propiedades

**Archivos afectados:**
- `src/pages/seller/SellerCatalogo.tsx` (líneas 141, 157, 165)
- `src/pages/seller/SellerInventarioB2C.tsx` (línea 111)

**Problema:** `getStats()` retorna `{ total, active, totalValue }` pero se esperan `totalProducts`, `activeProducts`, `totalStock`, `avgMargin`.

**Solución:** Modificar la función `getStats` en `src/hooks/useSellerCatalog.ts`:

```typescript
const getStats = useCallback(() => {
  const totalProducts = items.length;
  const activeProducts = items.filter(i => i.isActive).length;
  const totalStock = items.reduce((sum, i) => sum + (i.stock || 0), 0);
  const totalValue = items.reduce((sum, i) => sum + (i.precioVenta * (i.stock || 1)), 0);
  
  // Calcular margen promedio
  const margins = items.filter(i => i.precioCosto > 0).map(i => 
    ((i.precioVenta - i.precioCosto) / i.precioCosto) * 100
  );
  const avgMargin = margins.length > 0 
    ? margins.reduce((a, b) => a + b, 0) / margins.length 
    : 0;

  return { totalProducts, activeProducts, totalStock, totalValue, avgMargin };
}, [items]);
```

---

### Error 3: `useB2BServices.ts` import incorrecto

**Archivo:** `src/hooks/useB2BServices.ts` (línea 6)

**Problema:** 
```typescript
import { supabase } from '@/integrations/supabase';  // INCORRECTO
```

**Solución:**
```typescript
import { supabase } from '@/integrations/supabase/client';  // CORRECTO
```

---

### Error 4: `useB2BServices.ts` tipo UUID incompatible

**Archivo:** `src/hooks/useB2BServices.ts` (línea 395)

**Problema:** `addressId` puede ser `""` (string vacío) pero el tipo espera un UUID válido.

**Solución:** Agregar validación antes de asignar:

```typescript
// Cambiar línea 395:
addressId: selectedAddress?.id || '' as `${string}-${string}-${string}-${string}-${string}`,

// Por:
addressId: (selectedAddress?.id ?? '00000000-0000-0000-0000-000000000000') as `${string}-${string}-${string}-${string}-${string}`,
```

O mejor, usar un placeholder UUID válido cuando no hay dirección seleccionada.

---

### Error 5: `ProductPage.tsx` variable `dynamicPrice` no declarada

**Archivo:** `src/pages/ProductPage.tsx` (línea 897)

**Problema:** Se usa `dynamicPrice` pero nunca fue declarada.

**Solución:** Agregar declaración de estado cerca de las otras variables de estado (alrededor de línea 246-250):

```typescript
const [dynamicPrice, setDynamicPrice] = useState<number | null>(null);
```

---

### Error 6: `updateStock` en `SellerInventarioB2C` recibe 3 argumentos

**Archivo:** `src/pages/seller/SellerInventarioB2C.tsx` (línea 73)

**Problema:** La función `handleSaveStock` llama a `updateStock(itemId, newStock, reason)` pero el hook solo acepta 2 argumentos.

**Solución:** Actualizar `useSellerCatalog.ts` para aceptar el parámetro opcional `reason`:

```typescript
const updateStock = useCallback(async (
  itemId: string, 
  newStock: number, 
  reason?: string  // Agregar parámetro opcional
) => {
  // ... lógica existente
  // Opcionalmente registrar el reason en inventory_movements
}, []);
```

---

## Fase 2: Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/hooks/useSellerCatalog.ts` | Agregar `storeId`, extender `getStats()`, actualizar `updateStock()` |
| `src/hooks/useB2BServices.ts` | Corregir import, validar UUID |
| `src/pages/ProductPage.tsx` | Declarar `dynamicPrice` state |

---

## Fase 3: Continuar con B2B Multitramo

Una vez corregidos los errores, se procederá con:

### 3.1 Crear tipos para shipping multitramo

**Nuevo archivo:** `src/types/b2b-shipping.ts`

Contendrá interfaces para:
- `ShippingZone` (zonificación por país)
- `ShippingTier` (Standard/Express)
- `ProductShippingClass` (Standard/Oversize/Sensible)
- `MultitramoBreakdown` (desglose de costos)
- `HybridTrackingId` (formato de ID maestro)

### 3.2 Actualizar Motor de Precios

**Modificar:** `src/hooks/useB2BPricingEngine.ts`

Agregar:
- Conversión g → kg (Tramo A)
- Conversión g → lb (Tramo B)
- Lógica de redondeo agrupado
- Soporte para tiers Standard/Express

### 3.3 Componentes de Checkout

**Nuevos componentes:**
- `src/components/checkout/B2BShippingSelector.tsx`
- `src/components/checkout/B2BOrderSummary.tsx`
- `src/components/checkout/B2BWeightBreakdown.tsx`

---

## Sección Técnica

### Constantes de Conversión

```typescript
const GRAMS_TO_KG = 1000;
const GRAMS_TO_LB = 453.59237;
const MIN_BILLABLE_WEIGHT = 1;

// Redondeo B2B agrupado
const roundUp = (weight: number) => Math.max(MIN_BILLABLE_WEIGHT, Math.ceil(weight));

// Ejemplo:
// Peso total: 2150g
// Tramo A: ceil(2150/1000) = 3 kg facturables
// Tramo B: ceil(2150/453.59) = 5 lb facturables
```

### Estructura de getStats() Extendida

```typescript
interface SellerCatalogStats {
  totalProducts: number;    // Cantidad total de productos
  activeProducts: number;   // Productos publicados/activos
  totalStock: number;       // Suma de stock de todos los productos
  totalValue: number;       // Suma de (precio × stock)
  avgMargin: number;        // Margen promedio en porcentaje
}
```

---

## Resultado Esperado

Al completar esta fase:

1. Build exitoso sin errores TypeScript
2. `useSellerCatalog` retorna `storeId` correctamente
3. `getStats()` retorna todas las propiedades requeridas
4. `SellerInventarioB2C` y `SellerMarketingTools` funcionan correctamente
5. `ProductPage` puede mostrar precios dinámicos B2B
6. Base lista para implementar Motor Multitramo completo
