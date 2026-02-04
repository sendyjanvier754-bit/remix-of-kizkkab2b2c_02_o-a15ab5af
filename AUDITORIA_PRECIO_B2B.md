# AUDITORÍA EXHAUSTIVA - USO DE PRECIOS EN EL SISTEMA

> **Actualización:** 2026-02-04 - Búsqueda profunda completada
> **Total de archivos analizados:** 35+ archivos con referencias a precios
> **Archivos críticos identificados:** 15 archivos

---

## 📋 ÍNDICE RÁPIDO

1. [Problemas Críticos (11 archivos)](#-problemas-críticos-encontrados)
2. [Archivos Correctos (4 archivos)](#-uso-correcto-encontrado)
3. [Contexto Admin - Correcto (8 archivos)](#-contexto-admin---uso-correcto-de-tabla)
4. [Lista Completa de Tareas](#-lista-de-tareas-completa)
5. [Resumen por Prioridad](#-resumen-de-impacto)

---

## 🔍 HALLAZGOS DE LA AUDITORÍA

### ❌ PROBLEMAS CRÍTICOS ENCONTRADOS

#### 🔴 **GRUPO 1: CONTEXTO SELLER - CONSULTAS INCORRECTAS A TABLA**

#### 1. **B2BCatalogImportDialog.tsx** (LÍNEAS 49-117) - 🔴 CRÍTICO
**Problema:** Consulta tabla `products` directamente, no usa la vista
```tsx
// ❌ INCORRECTO - Línea 49
.from('products')
.select('id, sku_interno, nombre, descripcion_corta, precio_mayorista, precio_sugerido_venta, imagen_principal')

// ❌ INCORRECTO - Líneas 116-117
precio_costo: product.precio_mayorista,  // Usa tabla, no vista
precio_venta: product.precio_sugerido_venta || Math.ceil(product.precio_mayorista * 1.3)
```

**Impacto:** 🔴 CRÍTICO
- Sellers importan productos con precio base sin márgenes de mercado
- `precio_costo` incorrecto en `seller_catalog`
- **Impacto financiero directo:** Sellers pagan menos de lo debido

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, descripcion_corta, precio_b2b, precio_sugerido_venta, imagen_principal')

precio_costo: product.precio_b2b,  // De la vista
precio_venta: await calculate_suggested_pvp(product.id) || product.precio_sugerido_venta
```

---

#### 2. **SellerCartPage.tsx** (LÍNEAS 304, 314, 340-342, 369) - 🔴 CRÍTICO
**Problema:** Consulta tabla `products` para obtener precios
```tsx
// ❌ INCORRECTO - Múltiples líneas
.from('products')
.select('id, sku_interno, nombre, imagen_principal, precio_sugerido_venta, precio_mayorista, descripcion_larga, descripcion_corta')

costB2B: (productData as any).precio_mayorista || 0,  // Línea 369
```

**Impacto:** 🔴 CRÍTICO
- Carrito B2B muestra precios sin márgenes de mercado
- Seller ve precios incorrectos al agregar al carrito
- **Cálculos de totales incorrectos**

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, imagen_principal, precio_b2b, precio_sugerido_venta, descripcion_larga, descripcion_corta')

costB2B: (productData as any).precio_b2b || 0,
```

---

#### 3. **SellerMobileHeader.tsx** (LÍNEAS 142-143, 406) - 🟡 MEDIO
**Problema:** Búsqueda de productos usa tabla directa
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, nombre, sku_interno, imagen_principal, precio_mayorista, descripcion_corta")

// En UI - Línea 406
<p className="text-sm font-bold text-green-600">${product.precio_mayorista.toFixed(2)}</p>
```

**Impacto:** 🟡 MEDIO
- Búsqueda de productos muestra precios incorrectos
- Seller ve precio base en lugar de precio B2B real

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from("v_productos_con_precio_b2b")
.select("id, nombre, sku_interno, imagen_principal, precio_b2b, descripcion_corta")

<p>${product.precio_b2b.toFixed(2)}</p>
```

---

#### 4. **SellerDesktopHeader.tsx** (LÍNEAS 157-158, 436) - 🟡 MEDIO
**Problema:** Similar al anterior, búsqueda usa tabla
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, nombre, sku_interno, imagen_principal, precio_mayorista, descripcion_corta")

// En UI - Línea 436
<p>${product.precio_mayorista.toFixed(2)}</p>
```

**Impacto:** 🟡 MEDIO
- Búsqueda desktop muestra precios incorrectos

---

#### 5. **GlobalMobileHeader.tsx** (LÍNEA 169) - 🟡 MEDIO
**Problema:** Similar al anterior, búsqueda usa tabla
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, nombre, sku_interno, imagen_principal, precio_mayorista, descripcion_corta")
```

**Impacto:** 🟡 MEDIO
- Búsqueda global muestra precios incorrectos

---

#### 🟡 **GRUPO 2: HOOKS Y SERVICIOS - CONTEXTO MIXTO**

#### 6. **useCartMigration.ts** (LÍNEAS 37-38, 73-75) - 🔴 CRÍTICO
**Problema:** Migración de carrito usa tabla directa
```tsx
// ❌ INCORRECTO - Línea 37-38
.from('products')
.select('id, sku_interno, nombre, precio_mayorista, moq, stock_fisico, imagen_principal')

// ❌ INCORRECTO - Línea 73-75
unit_price: productData.precio_mayorista,
total_price: quantity * productData.precio_mayorista,
```

**Impacto:** 🔴 CRÍTICO
- Al migrar carrito, sellers obtienen precios incorrectos
- Los items migrados tienen `unit_price` sin márgenes

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, precio_b2b, moq, stock_fisico, imagen_principal')

unit_price: productData.precio_b2b,
total_price: quantity * productData.precio_b2b,
```

---

#### 7. **cartService.ts** (LÍNEA 176) - 🔴 CRÍTICO
**Problema:** Servicio de carrito busca producto por SKU en tabla
```tsx
// ❌ INCORRECTO - Línea 176
.from('products')
.select('id')
.eq('sku', skuBase)
```

**Impacto:** 🔴 CRÍTICO
- Servicio core de carrito no distingue contexto B2B
- Puede afectar inserción de items con precios incorrectos

**Corrección necesaria:**
```tsx
// ✅ CORRECTO - Depende del contexto
// Si es B2B: usar vista v_productos_con_precio_b2b
// Si es admin: tabla products está OK
```

---

#### 8. **useB2BCartLogistics.ts** (LÍNEA 72-73) - 🟢 BAJO
**Problema:** Consulta tabla para obtener detalles de logística
```tsx
// ❌ INCORRECTO
.from('products')
.select('id, precio_mayorista, categoria_id, peso_kg')
```

**Impacto:** 🟢 BAJO
- Solo consulta datos de peso/dimensiones
- Pero usa `precio_mayorista` para calcular costos de fábrica
- **Debería usar vista por consistencia**

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, precio_b2b, categoria_id, peso_kg')
```

---

#### 9. **useWishlist.ts** (LÍNEAS 73, 117) - 🟡 MEDIO
**Problema:** Wishlist B2B usa `precio_mayorista` de tabla
```tsx
// ❌ INCORRECTO - Línea 73
precio_mayorista,

// ❌ INCORRECTO - Línea 117
price: isB2B ? product?.precio_mayorista : catalog?.precio_venta || 0,
```

**Impacto:** 🟡 MEDIO
- Wishlist muestra precios incorrectos para items B2B
- Usuario ve precio sin márgenes

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
// Join con vista v_productos_con_precio_b2b en lugar de tabla products
price: isB2B ? product?.precio_b2b : catalog?.precio_venta || 0,
```

---

#### 🔴 **GRUPO 3: PÁGINAS PÚBLICAS - CONTEXTO B2C**

#### 10. **TrendsPage.tsx** (LÍNEAS 59, 73, 79, 81, 143) - 🟡 MEDIO
**Problema:** Página de tendencias usa `precio_mayorista` para mostrar precios
```tsx
// ❌ INCORRECTO - Múltiples líneas
Math.max(...trendingProducts.map(p => p.precio_sugerido_venta || p.precio_mayorista || 0), 1000);
const price = p.precio_sugerido_venta || p.precio_mayorista;
precio: p.precio_sugerido_venta || p.precio_mayorista,
```

**Impacto:** 🟡 MEDIO
- Página pública muestra precios mayoristas
- **Debería mostrar solo precio_sugerido_venta (PVP)**
- Expone precios de compra B2B a clientes finales

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
// Solo usar precio_sugerido_venta, no fallback a precio_mayorista
const price = p.precio_sugerido_venta || 0;
// O filtrar productos sin precio sugerido
```

---

#### 11. **CategoryProductsPage.tsx** (LÍNEAS 224-225, 299-300) - 🟡 MEDIO
**Problema:** Página de categorías usa `precio_mayorista` en fallback
```tsx
// ❌ INCORRECTO
priceB2B: p.precio_mayorista ?? price,
pvp: p.precio_sugerido_venta || price,
```

**Impacto:** 🟡 MEDIO
- Similar a TrendsPage
- Expone precios mayoristas en contexto público

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
// Solo PVP en páginas públicas
pvp: p.precio_sugerido_venta || 0,
// No exponer priceB2B en contexto B2C
```

---

#### 12. **useTrendingProducts.ts** (LÍNEAS 30, 43) - 🟡 MEDIO
**Problema:** Hook de productos trending consulta tabla con `precio_mayorista`
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, nombre, precio_mayorista, precio_sugerido_venta, imagen_principal, categoria_id, sku_interno, stock_status")
```

**Impacto:** 🟡 MEDIO
- Hook devuelve `precio_mayorista` a páginas públicas

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
// Si es para B2C: solo select precio_sugerido_venta
// Si es para B2B: usar vista v_productos_con_precio_b2b
.select("id, nombre, precio_sugerido_venta, imagen_principal, categoria_id, sku_interno, stock_status")
```

---

#### 13. **useTrendingCategories.ts** (LÍNEAS 44, 73) - 🟡 MEDIO
**Problema:** Similar a useTrendingProducts
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, sku_interno, nombre, imagen_principal, precio_sugerido_venta, precio_mayorista")

precio: p.precio_sugerido_venta || p.precio_mayorista,
```

**Impacto:** 🟡 MEDIO
- Categorías trending exponen precio_mayorista

---

#### 🟢 **GRUPO 4: CONSISTENCIA Y MANTENIBILIDAD**

#### 14. **useB2BCartSupabase.ts** (LÍNEA 80) - 🟢 BAJO
**Problema:** Consulta tabla para validar productos
```tsx
// ❌ INCORRECTO
.from('products')
.select('id, precio_mayorista, categoria_id, peso_kg')
```

**Impacto:** 🟢 BAJO
- Solo validación, pero debería usar vista por consistencia

---

#### 15. **useProductsB2B.ts** (LÍNEAS 80, 98-101, 379) - 🔴 CRÍTICO
**Problema:** Hook principal B2B consulta tabla directa
```tsx
// ❌ INCORRECTO - Línea 80
.from("products")
.select("*", { count: "exact" })

// ❌ INCORRECTO - Líneas 98-101
query = query.order("precio_mayorista", { ascending: true });
query = query.order("precio_mayorista", { ascending: false });
```

**Impacto:** 🔴 CRÍTICO
- **Hook más importante para catálogo B2B**
- Usa tabla directa y luego calcula precios manualmente
- Debería usar vista que ya tiene el cálculo correcto

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from("v_productos_con_precio_b2b")
.select("*", { count: "exact" })

// Ordenar por precio_b2b de la vista
query = query.order("precio_b2b", { ascending: true });
```

---
**Problema:** Consulta tabla `products` directamente, no usa la vista
```tsx
// ❌ INCORRECTO - Línea 49
.from('products')
.select('id, sku_interno, nombre, descripcion_corta, precio_mayorista, precio_sugerido_venta, imagen_principal')

// ❌ INCORRECTO - Líneas 116-117
precio_costo: product.precio_mayorista,  // Usa tabla, no vista
precio_venta: product.precio_sugerido_venta || Math.ceil(product.precio_mayorista * 1.3)
```

**Impacto:** 🔴 CRÍTICO
- Sellers importan productos con precio base sin márgenes de mercado
- `precio_costo` incorrecto en `seller_catalog`

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, descripcion_corta, precio_b2b, precio_sugerido_venta, imagen_principal')

precio_costo: product.precio_b2b,  // De la vista
precio_venta: await calculate_suggested_pvp(product.id) || product.precio_sugerido_venta
```

---

#### 2. **SellerCartPage.tsx** (LÍNEAS 304, 314, 340-342, 369)
**Problema:** Consulta tabla `products` para obtener precios
```tsx
// ❌ INCORRECTO - Múltiples líneas
.from('products')
.select('id, sku_interno, nombre, imagen_principal, precio_sugerido_venta, precio_mayorista, ...')

costB2B: (productData as any).precio_mayorista || 0,  // Línea 369
```

**Impacto:** 🔴 CRÍTICO
- Carrito B2B muestra precios sin márgenes de mercado
- Seller ve precios incorrectos al agregar al carrito

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, imagen_principal, precio_b2b, precio_sugerido_venta, ...')

costB2B: (productData as any).precio_b2b || 0,
```

---

#### 3. **SellerMobileHeader.tsx & SellerDesktopHeader.tsx** (LÍNEAS 142-143 / 157-158)
**Problema:** Búsqueda de productos usa tabla directa
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, nombre, sku_interno, imagen_principal, precio_mayorista, descripcion_corta")

// En UI - Línea 406/436
<p className="text-sm font-bold text-green-600">${product.precio_mayorista.toFixed(2)}</p>
```

**Impacto:** 🟡 MEDIO
- Búsqueda de productos muestra precios incorrectos
- Seller ve precio base en lugar de precio B2B real

**Corrección necesaria:**
```tsx
// ✅ CORRECTO
.from("v_productos_con_precio_b2b")
.select("id, nombre, sku_interno, imagen_principal, precio_b2b, descripcion_corta")

<p>${product.precio_b2b.toFixed(2)}</p>
```

---

#### 4. **GlobalMobileHeader.tsx** (LÍNEA 169)
**Problema:** Similar al anterior, búsqueda usa tabla
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, nombre, sku_interno, imagen_principal, precio_mayorista, descripcion_corta")
```

**Impacto:** 🟡 MEDIO
- Búsqueda global muestra precios incorrectos

---

#### 5. **useB2BCartLogistics.ts & useB2BCartSupabase.ts** (LÍNEAS 72 / 80)
**Problema:** Consulta tabla para validar productos en carrito
```tsx
// ❌ INCORRECTO
.from('products')
.select('id, sku_interno, peso_kg, weight_kg, ...')
```

**Impacto:** 🟢 BAJO
- Solo consulta datos de peso/dimensiones
- No afecta precios, pero debe corregirse por consistencia

---

### ✅ USO CORRECTO ENCONTRADO

#### 1. **ProductPage.tsx** (LÍNEA 120)
```tsx
// ✅ CORRECTO
.from("v_productos_con_precio_b2b").select(`
  *,
  category:categories!products_categoria_id_fkey(id, name, slug)
`)
```

#### 2. **AdminCatalogo.tsx** (LÍNEA 43)
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, precio_b2b');
```

#### 3. **useSellerCatalog.ts** (LÍNEA 62)
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select(`id, sku_interno, nombre, precio_b2b, ...`)
```

#### 4. **VariantDrawer.tsx** (LÍNEAS 44, 55)
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b').select('precio_b2b')
.from('v_variantes_con_precio_b2b').select('id, precio_b2b_final')
```

---

## ✅ LISTA DE TAREAS COMPLETA

### 🔴 FASE 1: BASE DE DATOS (PRIORIDAD ALTA)

- [ ] **Tarea 1.1:** Crear migración para agregar `default_markup_multiplier` a `categories`
  - Archivo: `supabase/migrations/20260203_add_category_markup.sql`
  - Valor por defecto: 4.0 (400% markup)
  - **Archivos afectados:** Estructura de BD

- [ ] **Tarea 1.2:** Crear vista `v_product_max_pvp` para PVP de otros sellers
  - Archivo: `supabase/migrations/20260203_create_pvp_view.sql`
  - **Archivos afectados:** Estructura de BD

- [ ] **Tarea 1.3:** Crear función `calculate_suggested_pvp(product_id, market_id)`
  - Archivo: `supabase/migrations/20260203_suggested_pvp_function.sql`
  - Lógica: sugerido → otros sellers → margen categoría
  - **Archivos afectados:** Estructura de BD

- [ ] **Tarea 1.4:** Script de migración de datos existentes
  - Actualizar `seller_catalog.precio_costo` con `precio_b2b` de vista
  - **Archivos afectados:** Datos en `seller_catalog`

---

### 🔴 FASE 2: CORRECCIONES CRÍTICAS (PRIORIDAD ALTA)

- [ ] **Tarea 2.1:** Corregir `B2BCatalogImportDialog.tsx`
  - **Archivo:** `src/components/seller/B2BCatalogImportDialog.tsx`
  - **Líneas:** 49-117
  - **Cambios:**
    - Línea 49: `.from('v_productos_con_precio_b2b')`
    - Línea 50: Agregar `precio_b2b` al select
    - Línea 116: `precio_costo: product.precio_b2b`
    - Línea 117: Usar `calculate_suggested_pvp()` o fallback

- [ ] **Tarea 2.2:** Corregir `SellerCartPage.tsx`
  - **Archivo:** `src/pages/seller/SellerCartPage.tsx`
  - **Líneas:** 304, 314, 340-342, 369
  - **Cambios:**
    - Todas las queries: `.from('v_productos_con_precio_b2b')`
    - Línea 342: `precio_b2b` en select
    - Línea 369: `costB2B: productData.precio_b2b`

- [ ] **Tarea 2.3:** Corregir headers de búsqueda (Mobile & Desktop)
  - **Archivos:** 
    - `src/components/seller/SellerMobileHeader.tsx` (líneas 142-143, 406)
    - `src/components/seller/SellerDesktopHeader.tsx` (líneas 157-158, 436)
  - **Cambios:**
    - Queries: `.from('v_productos_con_precio_b2b')`
    - Select: `precio_b2b` en lugar de `precio_mayorista`
    - UI: Mostrar `product.precio_b2b`

- [ ] **Tarea 2.4:** Corregir `GlobalMobileHeader.tsx`
  - **Archivo:** `src/components/layout/GlobalMobileHeader.tsx`
  - **Línea:** 169
  - **Cambios:** Similar a 2.3

---

### 🟡 FASE 3: HOOKS Y SERVICIOS (PRIORIDAD MEDIA)

- [ ] **Tarea 3.1:** Crear hook `usePricing.ts`
  - **Archivo:** `src/hooks/usePricing.ts` (nuevo)
  - **Funciones:**
    - `getSuggestedPVP(productId, marketId)` → Llama función SQL
    - `getProductB2BPrice(productId, marketId)` → Query vista
    - `getOtherSellersPrices(productId)` → Query vista PVP

- [ ] **Tarea 3.2:** Actualizar `useCatalog.tsx`
  - **Archivo:** `src/hooks/useCatalog.tsx`
  - **Cambios:**
    - Mantener tabla `products` para operaciones admin
    - Agregar método auxiliar para obtener `precio_b2b` de vista
    - Documentar cuándo usar cada fuente

- [ ] **Tarea 3.3:** Corregir `useSellerCatalog.ts`
  - **Archivo:** `src/hooks/useSellerCatalog.ts`
  - **Líneas:** 141, 170
  - **Cambios:**
    - Operaciones de update/delete pueden mantener tabla
    - Pero fetch debe ser desde vista (ya está correcto línea 62)

- [ ] **Tarea 3.4:** Corregir `useB2BCartLogistics.ts`
  - **Archivo:** `src/hooks/useB2BCartLogistics.ts`
  - **Línea:** 72
  - **Cambios:** Cambiar a vista por consistencia

- [ ] **Tarea 3.5:** Corregir `useB2BCartSupabase.ts`
  - **Archivo:** `src/hooks/useB2BCartSupabase.ts`
  - **Línea:** 80
  - **Cambios:** Cambiar a vista por consistencia

---

### 🟢 FASE 4: UI Y EXPERIENCIA (PRIORIDAD MEDIA)

- [ ] **Tarea 4.1:** Crear componente `PricingBreakdown.tsx`
  - **Archivo:** `src/components/pricing/PricingBreakdown.tsx` (nuevo)
  - **Propósito:** Mostrar desglose visual de precios
  - **Props:** productId, marketId
  - **Muestra:**
    - Precio de Compra B2B
    - PVP Sugerido
    - Comparación con otros sellers
    - Margen potencial

- [ ] **Tarea 4.2:** Integrar `PricingBreakdown` en `B2BCatalogImportDialog`
  - **Archivo:** `src/components/seller/B2BCatalogImportDialog.tsx`
  - **Ubicación:** Antes del botón "Importar"
  - **Muestra:** Info de pricing para productos seleccionados

- [ ] **Tarea 4.3:** Actualizar labels en toda la UI
  - **Archivos afectados:**
    - ProductPage.tsx
    - Todas las vistas de seller
  - **Cambios:**
    - "Precio Mayorista" → "Precio de Compra B2B"
    - Agregar "PVP Sugerido" donde corresponda
    - Clarificar que precio_b2b es el costo del seller

---

### 🟢 FASE 5: VALIDACIONES Y TESTING (PRIORIDAD BAJA)

- [ ] **Tarea 5.1:** Tests de función `calculate_suggested_pvp`
  - Escenario 1: Con precio sugerido configurado
  - Escenario 2: Sin precio sugerido, con otros sellers
  - Escenario 3: Sin precio sugerido, sin otros sellers
  - Escenario 4: Margen por categoría

- [ ] **Tarea 5.2:** Tests de importación de catálogo
  - Verificar precio_costo = precio_b2b
  - Verificar precio_venta calculado correctamente

- [ ] **Tarea 5.3:** Tests de carrito B2B
  - Verificar precios mostrados
  - Verificar cálculos de totales

---

## 📊 RESUMEN DE IMPACTO

### Por Prioridad:
- 🔴 **CRÍTICO (6 tareas):** B2BCatalogImportDialog, SellerCartPage, Headers
- 🟡 **MEDIO (5 tareas):** Hooks, servicios
- 🟢 **BAJO (8 tareas):** UI mejoras, testing

### Por Archivo:
| Archivo | Líneas | Impacto | Prioridad |
|---------|--------|---------|-----------|
| B2BCatalogImportDialog.tsx | 49-117 | 🔴 CRÍTICO | Alta |
| SellerCartPage.tsx | 304, 314, 340-342, 369 | 🔴 CRÍTICO | Alta |
| SellerMobileHeader.tsx | 142-143, 406 | 🟡 MEDIO | Media |
| SellerDesktopHeader.tsx | 157-158, 436 | 🟡 MEDIO | Media |
| GlobalMobileHeader.tsx | 169 | 🟡 MEDIO | Media |
| useB2BCartLogistics.ts | 72 | 🟢 BAJO | Baja |
| useB2BCartSupabase.ts | 80 | 🟢 BAJO | Baja |

### Estimación de Esfuerzo:
- **FASE 1 (BD):** 2-3 horas
- **FASE 2 (Crítico):** 4-5 horas
- **FASE 3 (Hooks):** 3-4 horas
- **FASE 4 (UI):** 3-4 horas
- **FASE 5 (Testing):** 2-3 horas
- **TOTAL:** ~14-19 horas

---

## 🎯 ORDEN DE EJECUCIÓN RECOMENDADO

1. **FASE 1:** Base de datos (migraciones, vistas, funciones)
2. **FASE 2, Tarea 2.1:** B2BCatalogImportDialog (más crítico)
3. **FASE 2, Tarea 2.2:** SellerCartPage
4. **FASE 2, Tareas 2.3-2.4:** Headers
5. **FASE 3:** Hooks y servicios
6. **FASE 4:** UI y experiencia
7. **FASE 5:** Testing

---

**Fecha de auditoría:** 2026-02-03
**Estado:** Listo para implementación
**Prioridad global:** 🔴 CRÍTICA
