# PLAN DE EJECUCIÓN COMPLETO - CORRECCIÓN DE PRECIOS B2B

> **Fecha:** 2026-02-04  
> **Objetivo:** Corregir arquitectura de precios B2B en todo el sistema  
> **Estimación Total:** 20-27 horas  
> **Mínimo Viable:** 11-15 horas (FASES 1-4)

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#-resumen-ejecutivo)
2. [Conceptos Clave](#-conceptos-clave)
3. [Lista Completa de Archivos](#-lista-completa-de-archivos)
4. [Fases de Implementación](#-fases-de-implementación)
5. [Checklist de Validación](#-checklist-de-validación)

---

## 🎯 RESUMEN EJECUTIVO

### Problema a Resolver:
El sistema tiene **15 archivos** que consultan la tabla `products` directamente en lugar de la vista `v_productos_con_precio_b2b`, causando:
- Sellers pagando precios incorrectos (sin márgenes de mercado)
- UX inconsistente (precios diferentes según dónde se consulten)
- Exposición de precios confidenciales en páginas públicas

### Solución:
1. Crear migraciones de base de datos (vistas y funciones nuevas)
2. Corregir 15 archivos para usar vista `v_productos_con_precio_b2b`
3. Implementar validación por rol para exposición de precios
4. Crear componentes reutilizables para mostrar márgenes a sellers

---

## 💡 CONCEPTOS CLAVE

### ⚠️ Diferencia CRÍTICA: precio_b2b vs PVP

| Concepto | Campo en BD | Significado | Ejemplo |
|----------|-------------|-------------|---------|
| **precio_b2b** | `v_productos_con_precio_b2b.precio_b2b` (vista) | Lo que el seller **PAGA** al admin | $18.00 |
| **PVP** | `seller_catalog.precio_venta` (tabla) | Lo que el seller **COBRA** a sus clientes | $30.00 |
| precio_mayorista_base | `products.precio_mayorista_base` (tabla) | Precio base interno (sin márgenes) | $15.00 |
| precio_sugerido_venta | `products.precio_sugerido_venta` (tabla) | PVP sugerido por admin (opcional) | $30.00 |

### 📊 Flujo de Precios:

```
ADMIN configura:
  └─ costo_base_excel = $10
  └─ precio_mayorista_base = $15
  └─ precio_sugerido_venta = $30 (opcional)

        ↓ VISTA calcula dinámicamente

v_productos_con_precio_b2b:
  └─ precio_b2b = $18 (base + márgenes + fee)
          ↓
SELLER compra a precio_b2b ($18)
SELLER configura PVP ($30)
          ↓
CLIENTE FINAL paga PVP ($30)
```

---

## 📁 LISTA COMPLETA DE ARCHIVOS

### 🔴 CRÍTICOS (6 archivos) - FASE 2

| # | Archivo | Líneas | Problema | Prioridad |
|---|---------|--------|----------|-----------|
| 1 | `src/components/seller/B2BCatalogImportDialog.tsx` | 49-117 | Importa con precio_mayorista sin márgenes | 🔴 1 |
| 2 | `src/pages/seller/SellerCartPage.tsx` | 304, 314, 340-342, 369 | Carrito muestra precios incorrectos | 🔴 2 |
| 3 | `src/services/cartService.ts` | 176 | No distingue contexto B2B vs B2C | 🔴 3 |
| 4 | `src/hooks/useCartMigration.ts` | 37-38, 73-75 | Migración con precios incorrectos | 🔴 4 |
| 5 | `src/hooks/useProductsB2B.ts` | 80, 98-101, 248-249, 379 | Hook principal usa tabla directa | 🔴 5 |
| 6 | `src/hooks/useBuyerOrders.ts` | 157 | Detalles de pedidos incorrectos | 🔴 6 |

### 🟡 MEDIOS (7 archivos) - FASE 3 y 4

| # | Archivo | Líneas | Problema | Prioridad |
|---|---------|--------|----------|-----------|
| 7 | `src/components/seller/SellerMobileHeader.tsx` | 142-143, 406 | Búsqueda muestra precios sin márgenes | 🟡 7 |
| 8 | `src/components/seller/SellerDesktopHeader.tsx` | 157-158, 436 | Idéntico a mobile | 🟡 8 |
| 9 | `src/components/layout/GlobalMobileHeader.tsx` | 169 | No valida contexto usuario | 🟡 9 |
| 10 | `src/pages/TrendsPage.tsx` | 59, 73, 79, 81, 143 | Expone precios B2B a todos | 🟡 10 |
| 11 | `src/pages/CategoryProductsPage.tsx` | 224-225, 299-300 | Expone precio_mayorista públicamente | 🟡 11 |
| 12 | `src/hooks/useTrendingProducts.ts` | 30, 43 | Hook devuelve precio_mayorista | 🟡 12 |
| 13 | `src/hooks/useTrendingCategories.ts` | 44, 73 | Similar a trending products | 🟡 13 |

### 🟢 BAJOS (4 archivos) - FASE 5

| # | Archivo | Líneas | Problema | Prioridad |
|---|---------|--------|----------|-----------|
| 14 | `src/hooks/useWishlist.ts` | 73, 117 | Wishlist con precios incorrectos | 🟢 14 |
| 15 | `src/hooks/useB2BCartLogistics.ts` | 72-73, 142 | Inconsistencia en logística | 🟢 15 |
| 16 | `src/hooks/useB2BCartSupabase.ts` | 80 | Similar a logística | 🟢 16 |
| 17 | `src/hooks/useSmartProductGrouper.ts` | 152, 377, 386 | Agrupador usa tabla directa | 🟢 17 |

### ➕ NUEVOS (5 archivos a crear)

| # | Archivo | Propósito |
|---|---------|-----------|
| 18 | `src/hooks/usePricing.ts` | Hook centralizado de precios |
| 19 | `src/components/products/SellerMarginBadge.tsx` | Badge de margen para sellers |
| 20 | `src/components/pricing/PricingBreakdown.tsx` | Desglose visual de precios |
| 21 | `supabase/migrations/20260204_add_category_markup.sql` | Columna markup en categories |
| 22 | `supabase/migrations/20260204_create_pvp_view.sql` | Vista de PVPs de sellers |
| 23 | `supabase/migrations/20260204_suggested_pvp_function.sql` | Función calcular PVP sugerido |
| 24 | `supabase/migrations/20260204_migrate_seller_prices.sql` | Migración datos existentes |

**Total: 24 archivos (17 a modificar + 7 a crear)**

---

## 🚀 FASES DE IMPLEMENTACIÓN

### 🔴 FASE 1: BASE DE DATOS (PRIORIDAD MÁXIMA)
**Estimación:** 2-3 horas  
**Dependencias:** Ninguna

#### Tarea 1.1: Agregar markup a categories
- **Archivo:** `supabase/migrations/20260204_add_category_markup.sql`
- **SQL:**
  ```sql
  ALTER TABLE categories 
  ADD COLUMN IF NOT EXISTS default_markup_multiplier NUMERIC DEFAULT 4.0;
  
  COMMENT ON COLUMN categories.default_markup_multiplier IS 
    'Multiplicador para calcular PVP sugerido (4.0 = 400%)';
  ```

#### Tarea 1.2: Vista de PVPs de otros sellers
- **Archivo:** `supabase/migrations/20260204_create_pvp_view.sql`
- **SQL:**
  ```sql
  CREATE OR REPLACE VIEW v_product_max_pvp AS
  SELECT 
    sc.product_id,
    MAX(sc.precio_venta) as max_pvp,
    MIN(sc.precio_venta) as min_pvp,
    AVG(sc.precio_venta) as avg_pvp,
    COUNT(DISTINCT sc.seller_store_id) as seller_count
  FROM seller_catalog sc
  WHERE sc.is_active = TRUE
  GROUP BY sc.product_id;
  ```

#### Tarea 1.3: Función calcular PVP sugerido
- **Archivo:** `supabase/migrations/20260204_suggested_pvp_function.sql`
- **Lógica:**
  1. Si existe `precio_sugerido_venta` → Retornar ese
  2. Si no, buscar MAX PVP de otros sellers → Retornar ese
  3. Si no, calcular `precio_b2b × markup_categoria` → Retornar ese
  4. Fallback: `precio_b2b × 4`

#### Tarea 1.4: Migración de datos existentes
- **Archivo:** `supabase/migrations/20260204_migrate_seller_prices.sql`
- **SQL:**
  ```sql
  UPDATE seller_catalog sc
  SET precio_costo = vp.precio_b2b
  FROM v_productos_con_precio_b2b vp
  WHERE sc.product_id = vp.id
    AND sc.precio_costo != vp.precio_b2b;
  ```

---

### 🔴 FASE 2: CORRECCIONES CRÍTICAS (6 archivos)
**Estimación:** 5-6 horas  
**Dependencias:** FASE 1 completada

#### Tarea 2.1: B2BCatalogImportDialog.tsx
- **Cambios:**
  ```tsx
  // ❌ ANTES
  .from('products')
  .select('..., precio_mayorista, ...')
  precio_costo: product.precio_mayorista,
  
  // ✅ DESPUÉS
  .from('v_productos_con_precio_b2b')
  .select('..., precio_b2b, ...')
  precio_costo: product.precio_b2b,
  precio_venta: await supabase.rpc('calculate_suggested_pvp', { 
    p_product_id: product.id 
  })
  ```

#### Tarea 2.2: SellerCartPage.tsx
- **Líneas a cambiar:** 304, 314, 340-342, 369
- **Cambios:**
  ```tsx
  // Todas las queries
  .from('v_productos_con_precio_b2b')
  .select('..., precio_b2b, ...')
  
  costB2B: (productData as any).precio_b2b || 0
  ```

#### Tarea 2.3: cartService.ts
- **Línea:** 176
- **Cambios:**
  ```tsx
  // Agregar parámetro context
  async function addToCart(params: AddToCartParams & { context: 'B2B' | 'B2C' }) {
    const table = params.context === 'B2B' 
      ? 'v_productos_con_precio_b2b' 
      : 'products';
  }
  ```

#### Tarea 2.4: useCartMigration.ts
- **Líneas:** 37-38, 73-75
- **Cambios:** Similar a 2.2

#### Tarea 2.5: useProductsB2B.ts
- **Líneas:** 80, 98-101, 248-249, 379
- **Cambios:**
  ```tsx
  // Query base
  .from("v_productos_con_precio_b2b")
  
  // Ordenamiento
  query.order("precio_b2b", { ascending: true })
  
  // Uso
  const factoryCost = p.precio_b2b || 0
  ```

#### Tarea 2.6: useBuyerOrders.ts
- **Línea:** 157
- **Cambios:** Usar vista para detalles

---

### 🟡 FASE 3: HEADERS Y BÚSQUEDAS (3 archivos)
**Estimación:** 2-3 horas

#### Tarea 3.1: SellerMobileHeader.tsx
- **Líneas:** 142-143, 406
- **Cambios:**
  ```tsx
  .from("v_productos_con_precio_b2b")
  .select("..., precio_b2b, ...")
  
  <p>${product.precio_b2b.toFixed(2)}</p>
  ```

#### Tarea 3.2: SellerDesktopHeader.tsx
- **Líneas:** 157-158, 436
- **Cambios:** Idéntico a 3.1

#### Tarea 3.3: GlobalMobileHeader.tsx
- **Línea:** 169
- **Cambios:**
  ```tsx
  const { user } = useAuthStore();
  const isSeller = user?.role === 'seller' || user?.role === 'admin';
  
  const table = isSeller ? 'v_productos_con_precio_b2b' : 'products';
  const priceField = isSeller ? 'precio_b2b' : 'precio_sugerido_venta';
  ```

---

### 🟡 FASE 4: SEGURIDAD PÁGINAS PÚBLICAS (5 archivos)
**Estimación:** 3-4 horas

#### Tarea 4.1: Crear SellerMarginBadge.tsx (NUEVO)
- **Archivo:** `src/components/products/SellerMarginBadge.tsx`
- **Props:** `pvp: number, precioB2B: number`
- **Código:**
  ```tsx
  interface Props {
    pvp: number;
    precioB2B: number;
  }
  
  export const SellerMarginBadge = ({ pvp, precioB2B }: Props) => {
    const margen = pvp - precioB2B;
    const porcentaje = ((margen / precioB2B) * 100).toFixed(0);
    
    return (
      <div className="bg-green-50 p-2 rounded border border-green-200">
        <p className="text-xs text-green-700 font-semibold">
          💰 Tu precio de compra B2B: ${precioB2B.toFixed(2)}
        </p>
        <p className="text-xs text-green-600">
          📈 PVP sugerido: ${pvp.toFixed(2)}
        </p>
        <p className="text-xs text-green-600 font-semibold">
          🎯 Margen potencial: ${margen.toFixed(2)} ({porcentaje}%)
        </p>
        <p className="text-[10px] text-gray-500 mt-1">
          * PVP es el precio que tú configurarías para tus clientes
        </p>
      </div>
    );
  };
  ```

#### Tarea 4.2: TrendsPage.tsx
- **Líneas:** 59, 73, 79, 81, 143
- **Cambios:**
  ```tsx
  const { user } = useAuthStore();
  const isSeller = user?.role === 'seller' || user?.role === 'admin';
  
  const { data: products } = await supabase
    .from(isSeller ? 'v_productos_con_precio_b2b' : 'products')
    .select(isSeller 
      ? 'id, nombre, precio_sugerido_venta, precio_b2b, ...'
      : 'id, nombre, precio_sugerido_venta, ...'
    );
  
  // En UI
  {isSeller && product.precio_b2b && (
    <SellerMarginBadge 
      pvp={product.precio_sugerido_venta} 
      precioB2B={product.precio_b2b} 
    />
  )}
  ```

#### Tarea 4.3: CategoryProductsPage.tsx
- **Líneas:** 224-225, 299-300
- **Cambios:** Similar a 4.2

#### Tarea 4.4: useTrendingProducts.ts
- **Líneas:** 30, 43
- **Cambios:**
  ```tsx
  export const useTrendingProducts = (userRole?: string) => {
    const isSeller = userRole === 'seller' || userRole === 'admin';
    
    const query = supabase
      .from(isSeller ? 'v_productos_con_precio_b2b' : 'products')
      .select(isSeller ? '*, precio_b2b' : '*');
    
    return { products, isSeller };
  };
  ```

#### Tarea 4.5: useTrendingCategories.ts
- **Líneas:** 44, 73
- **Cambios:** Similar a 4.4

---

### 🟢 FASE 5: HOOKS COMPLEMENTARIOS (5 archivos)
**Estimación:** 3-4 horas

#### Tarea 5.1: Crear usePricing.ts (NUEVO)
- **Archivo:** `src/hooks/usePricing.ts`
- **Código:**
  ```typescript
  export const usePricing = () => {
    const getSuggestedPVP = async (productId: string) => {
      const { data, error } = await supabase.rpc('calculate_suggested_pvp', {
        p_product_id: productId
      });
      return data;
    };
    
    const getProductB2BPrice = async (productId: string) => {
      const { data } = await supabase
        .from('v_productos_con_precio_b2b')
        .select('precio_b2b')
        .eq('id', productId)
        .single();
      return data?.precio_b2b;
    };
    
    const getOtherSellersPrices = async (productId: string) => {
      const { data } = await supabase
        .from('v_product_max_pvp')
        .select('*')
        .eq('product_id', productId)
        .single();
      return data;
    };
    
    return { getSuggestedPVP, getProductB2BPrice, getOtherSellersPrices };
  };
  ```

#### Tarea 5.2: useWishlist.ts
- **Líneas:** 73, 117
- **Cambios:** Usar vista para items B2B

#### Tarea 5.3: useB2BCartLogistics.ts
- **Líneas:** 72-73, 142
- **Cambios:**
  ```tsx
  .from('v_productos_con_precio_b2b')
  .select('id, precio_b2b, categoria_id, peso_kg')
  
  const factoryCost = product?.precio_b2b || item.precioB2B
  ```

#### Tarea 5.4: useB2BCartSupabase.ts
- **Línea:** 80
- **Cambios:** Similar a 5.3

#### Tarea 5.5: useSmartProductGrouper.ts
- **Líneas:** 152, 377, 386
- **Cambios:** Usar vista según contexto

---

### 🟢 FASE 6: UI Y EXPERIENCIA (3 archivos - OPCIONAL)
**Estimación:** 3-4 horas

#### Tarea 6.1: Crear PricingBreakdown.tsx (NUEVO)
- **Archivo:** `src/components/pricing/PricingBreakdown.tsx`
- **Props:** `productId: string, marketId?: string`
- **Muestra:**
  - Precio de compra B2B
  - PVP sugerido
  - PVP de otros sellers (max/min/avg)
  - Margen potencial

#### Tarea 6.2: Integrar PricingBreakdown en B2BCatalogImportDialog
- Ubicación: Antes del botón "Importar"
- Muestra info para productos seleccionados

#### Tarea 6.3: Actualizar labels en UI
- "Precio Mayorista" → "Precio de Compra B2B"
- Agregar tooltips explicativos

---

### 🟢 FASE 7: TESTING (4 grupos de tests - OPCIONAL)
**Estimación:** 3-4 horas

#### Tarea 7.1: Tests de función SQL
- Escenarios con/sin precio_sugerido_venta
- Escenarios con/sin otros sellers
- Escenarios con diferentes categorías

#### Tarea 7.2: Tests de importación
- Verificar precio_costo = precio_b2b
- Verificar precio_venta calculado correctamente

#### Tarea 7.3: Tests de carrito
- Agregar productos
- Verificar precios y totales

#### Tarea 7.4: Tests E2E
- Flujo: Búsqueda → Detalle → Carrito → Checkout
- Verificar consistencia de precios

---

## ✅ CHECKLIST DE VALIDACIÓN

### Pre-Implementación
- [ ] Backup de base de datos creado
- [ ] Branch de desarrollo creado (`feature/fix-pricing-architecture`)
- [ ] Documentación revisada y entendida
- [ ] Equipo notificado del plan

### Post-FASE 1 (Base de Datos)
- [ ] Migraciones ejecutadas sin errores
- [ ] Función `calculate_suggested_pvp` retorna valores correctos
- [ ] Vista `v_product_max_pvp` tiene datos
- [ ] Columna `default_markup_multiplier` agregada a `categories`

### Post-FASE 2 (Críticos)
- [ ] Importación de catálogo usa precio_b2b
- [ ] Carrito B2B muestra precios correctos
- [ ] cartService distingue contexto B2B vs B2C
- [ ] Migración de carrito usa precio_b2b
- [ ] useProductsB2B consulta vista
- [ ] useBuyerOrders usa vista

### Post-FASE 3 (Headers)
- [ ] Búsquedas mobile/desktop muestran precio_b2b
- [ ] GlobalMobileHeader valida contexto usuario

### Post-FASE 4 (Seguridad)
- [ ] SellerMarginBadge creado y funcional
- [ ] TrendsPage valida rol antes de mostrar precio_b2b
- [ ] CategoryProductsPage valida rol
- [ ] useTrendingProducts acepta parámetro rol
- [ ] useTrendingCategories acepta parámetro rol

### Post-FASE 5 (Hooks)
- [ ] usePricing hook creado y funcional
- [ ] useWishlist usa vista para B2B
- [ ] useB2BCartLogistics usa vista
- [ ] useB2BCartSupabase usa vista
- [ ] useSmartProductGrouper usa vista

### Validación Final
- [ ] Todos los tests E2E pasan
- [ ] No hay errores en consola
- [ ] Performance no se degradó
- [ ] Métricas de Éxito alcanzadas:
  - [ ] 0% productos con precio_costo incorrecto
  - [ ] 100% consultas seller usan vista
  - [ ] 0% exposición de precio_mayorista en páginas públicas

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Objetivo | Cómo Validar |
|---------|----------|--------------|
| Productos con precio_costo correcto | 100% | Query: `SELECT COUNT(*) FROM seller_catalog sc JOIN v_productos_con_precio_b2b vp ON sc.product_id = vp.id WHERE sc.precio_costo = vp.precio_b2b` |
| Consultas usando vista | 100% | Code review + grep search de `.from('products')` en contexto seller |
| Exposición de precios B2B | 0% | Probar páginas públicas sin login + con login cliente |
| Tests E2E pasando | 100% | `npm run test:e2e` |

---

## 🔗 DOCUMENTOS DE REFERENCIA

- [AUDITORIA_PRECIO_B2B_COMPLETA.md](./AUDITORIA_PRECIO_B2B_COMPLETA.md) - Auditoría detallada
- [ARQUITECTURA_PRECIOS_CORREGIDA.md](./ARQUITECTURA_PRECIOS_CORREGIDA.md) - Arquitectura correcta
- [PLAN_IMPLEMENTACION_PRICING.md](./PLAN_IMPLEMENTACION_PRICING.md) - Plan original

---

**Estado:** 📋 Plan definido - Listo para comenzar  
**Siguiente Paso:** Ejecutar FASE 1 (Migraciones BD)  
**Prioridad:** 🔴 CRÍTICA
