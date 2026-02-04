# AUDITORÍA EXHAUSTIVA - USO DE PRECIOS EN EL SISTEMA

> **Actualización:** 2026-02-04 - Búsqueda profunda completada  
> **Total de archivos analizados:** 35+ archivos con referencias a precios  
> **Archivos críticos identificados:** 15 archivos  
> **Método:** Búsqueda regex exhaustiva + análisis manual de código

---

## 📋 ÍNDICE RÁPIDO

1. [Resumen Ejecutivo](#-resumen-ejecutivo)
2. [⚠️ Aclaración de Nomenclatura](#️-aclaración-de-nomenclatura)
3. [Problemas Críticos (15 archivos)](#-problemas-críticos-encontrados)
4. [Archivos Correctos (4 archivos)](#-uso-correcto-encontrado)
5. [Contexto Admin - Correcto (8 archivos)](#-contexto-admin---uso-correcto-de-tabla)
6. [Lista Completa de Tareas](#-lista-de-tareas-completa)
7. [Matriz de Prioridades](#-matriz-de-prioridades)

---

## 📊 RESUMEN EJECUTIVO

### Estadísticas Clave:
- **Total de archivos con precios:** 35+
- **Archivos con problemas:** 15 (43%)
- **Archivos correctos:** 4 (11%)
- **Archivos admin (correctos):** 8 (23%)
- **Archivos sin revisar:** 8 (23%)

### Distribución por Impacto:
- 🔴 **CRÍTICO (6 archivos):** B2BCatalogImportDialog, SellerCartPage, cartService, useCartMigration, useProductsB2B, useBuyerOrders
- 🟡 **MEDIO (7 archivos):** Headers, TrendsPage, CategoryProductsPage, useTrendingProducts, useTrendingCategories, useWishlist, useSmartProductGrouper
- 🟢 **BAJO (2 archivos):** useB2BCartLogistics, useB2BCartSupabase

### Principales Hallazgos:
1. **Confusión arquitectural:** Sistema mezcla consultas a tabla `products` (precio base) con vista `v_productos_con_precio_b2b` (precio con márgenes)
2. **Impacto financiero:** Sellers pueden importar productos y comprar a precio base sin márgenes de mercado
3. **UX inconsistente:** Precios mostrados varían según dónde se consulten (búsqueda vs detalle)
4. **Exposición de datos:** Páginas públicas B2C exponen `precio_mayorista` a TODOS los usuarios sin validar rol (debería mostrarse solo a sellers/admins como incentivo de venta)

---

## ⚠️ ACLARACIÓN DE NOMENCLATURA

### 🏷️ **Diferencia CRÍTICA entre precio_b2b y PVP**

Es fundamental entender que `precio_b2b` y `PVP` son **conceptos completamente diferentes**:

| Concepto | Campo en BD | Ubicación | Significado | Quién lo ve |
|----------|-------------|-----------|-------------|-------------|
| **precio_b2b** | `v_productos_con_precio_b2b.precio_b2b` | Vista calculada | **Precio de COMPRA del seller** (lo que el seller PAGA). Base para calcular PVP | Sellers, Admins |
| **PVP** | `seller_catalog.precio_venta` | Tabla seller_catalog | **Precio de VENTA del seller** (lo que el seller COBRA). Se calcula: precio_b2b × markup | Clientes finales, Buyers |
| precio_sugerido_venta | `products.precio_sugerido_venta` | Tabla products | PVP sugerido por admin (opcional) o calculado: precio_b2b × markup | Admin configura |

### 📊 **Flujo Completo de Precios:**

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN                                                        │
├─────────────────────────────────────────────────────────────┤
│ Configura: costo_base_excel = $10                          │
│ Configura: precio_mayorista_base = $15                     │
│ Configura (opcional): precio_sugerido_venta = $30          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ VISTA v_productos_con_precio_b2b (CALCULADO)               │
├─────────────────────────────────────────────────────────────┤
│ precio_b2b = calculate_base_price_only()                    │
│            = $10 + margen(30%) + fee(12%)                   │
│            = $14.56                                          │
│                                                              │
│ ⚠️ IMPORTANTE: El precio_b2b YA INCLUYE TODOS LOS MÁRGENES │
│    Este es el precio desde el cual se calcula el PVP       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ FUNCIÓN calculate_suggested_pvp() - CALCULA PVP            │
├─────────────────────────────────────────────────────────────┤
│ Prioridad 1: precio_sugerido_venta del admin (si existe)   │
│ Prioridad 2: MAX PVP de otros sellers en el mercado        │
│ Prioridad 3: precio_b2b × category.markup_multiplier       │
│              = $14.56 × 4.0 = $58.24                        │
│ Fallback:    precio_b2b × 4.0                               │
│                                                              │
│ ⚠️ CRÍTICO: Se multiplica precio_b2b (CON márgenes),      │
│    NO precio_mayorista_base (SIN márgenes del Excel)       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ SELLER importa producto a su catálogo                       │
├─────────────────────────────────────────────────────────────┤
// Importar a seller_catalog:
precio_costo: product.precio_b2b,  // ← $14.56 - Lo que seller PAGA
precio_venta: await calculate_suggested_pvp(product.id)  // ← $58.24 - PVP que seller COBRA
│                                                              │
│ ⚠️ PVP ≠ precio_b2b                                         │
│ PVP ($58.24) = precio_b2b ($14.56) × 4.0                   │
│ PVP es lo que el SELLER cobra a SUS CLIENTES               │
│ precio_b2b es lo que el SELLER paga AL ADMIN               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE FINAL compra del seller                             │
├─────────────────────────────────────────────────────────────┤
│ Ve y paga: $30.00 (PVP del seller)                         │
│ NO ve: $14.56 (precio_b2b - confidencial del seller)      │
└─────────────────────────────────────────────────────────────┘
```

### 🚨 **IMPORTANTE: NO Confundir**

```tsx
// ❌ INCORRECTO - Confundir precio_b2b con PVP
const pvp = product.precio_b2b;  // ¡MAL! precio_b2b NO es PVP

// ❌ INCORRECTO - Calcular PVP desde precio_mayorista_base (Excel sin márgenes)
const pvp = product.precio_mayorista_base * 4.0;  // ¡MAL! Falta incluir márgenes de mercado

// ✅ CORRECTO - Calcular PVP desde precio_b2b (vista CON márgenes)
const pvp = product.precio_b2b * category.markup_multiplier;  // ¡BIEN! Incluye márgenes

// ✅ CORRECTO - Entender la diferencia
const precioCompraB2B = product.precio_b2b;        // Lo que seller PAGA (CON márgenes)
const pvp = sellerCatalog.precio_venta;            // Lo que seller COBRA
const margenSeller = pvp - precioCompraB2B;        // Ganancia del seller
```

### ⚠️ **CRÍTICO: Base del Cálculo de PVP**

```
❌ INCORRECTO:
precio_mayorista_base ($15 del Excel) × 4.0 = $60 PVP
                ↑
         SIN márgenes de mercado
         Resultado: Precio muy bajo, pérdida de ganancia

✅ CORRECTO:
precio_b2b ($14.56 de vista) × 4.0 = $58.24 PVP
       ↑
   CON márgenes de mercado (30% + 12% fee)
   Resultado: Precio realista que cubre todos los costos

Diferencia: El precio_b2b YA incluye los márgenes de mercado calculados
por la vista. Por eso el PVP se calcula desde precio_b2b, NO desde
precio_mayorista_base.
```

### 📝 **Guía de Uso de Términos:**

- **`precio_b2b`**: SIEMPRE se refiere al precio de compra del seller (origen: vista). **BASE para calcular PVP**
- **`PVP` o `precio_venta`**: SIEMPRE se refiere al precio de venta del seller (origen: seller_catalog). Se calcula: `precio_b2b × markup_multiplier`
- **`precio_sugerido_venta`**: PVP recomendado por admin (opcional, origen: products). Si no existe, se calcula desde `precio_b2b`
- **`precio_costo`**: Lo que el seller pagó = debe ser igual a precio_b2b (origen: seller_catalog)
- **`precio_mayorista_base`**: Precio base del Excel SIN márgenes (origen: products). **NO usar para calcular PVP**

### ⚠️ **Regla de Oro para Calcular PVP:**

```typescript
// ✅ SIEMPRE usar precio_b2b como base (CON márgenes de mercado)
const pvpSugerido = precio_b2b * markup_multiplier;

// ❌ NUNCA usar precio_mayorista_base (SIN márgenes de mercado)
const pvpIncorrecto = precio_mayorista_base * markup_multiplier;  // ¡ERROR!
```

---

## 🔍 HALLAZGOS DE LA AUDITORÍA

### ❌ PROBLEMAS CRÍTICOS ENCONTRADOS

#### 🔴 **GRUPO 1: CONTEXTO SELLER - CONSULTAS INCORRECTAS A TABLA**

---

#### 1. **B2BCatalogImportDialog.tsx** - 🔴 CRÍTICO
**Archivo:** `src/components/seller/B2BCatalogImportDialog.tsx`  
**Líneas:** 49-117

**Problema:**
```tsx
// ❌ INCORRECTO - Línea 49
.from('products')
.select('id, sku_interno, nombre, descripcion_corta, precio_mayorista, precio_sugerido_venta, imagen_principal')

// ❌ INCORRECTO - Líneas 116-117
precio_costo: product.precio_mayorista,  // ← Precio base sin márgenes
precio_venta: product.precio_sugerido_venta || Math.ceil(product.precio_mayorista * 1.3)
```

**Impacto:** 🔴 CRÍTICO
- Sellers importan productos con `precio_costo` = `precio_mayorista_base` (sin márgenes de mercado)
- **Impacto financiero directo:** Sellers pagan menos de lo debido
- Todos los productos importados tendrán precios incorrectos en `seller_catalog`

**Corrección:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, descripcion_corta, precio_b2b, precio_sugerido_venta, imagen_principal')

precio_costo: product.precio_b2b,  // ← Precio con márgenes de mercado
precio_venta: await calculate_suggested_pvp(product.id) || product.precio_sugerido_venta
```

**Prioridad:** 🔴 CRÍTICA - Implementar ANTES de cualquier otra corrección

---

#### 2. **SellerCartPage.tsx** - 🔴 CRÍTICO
**Archivo:** `src/pages/seller/SellerCartPage.tsx`  
**Líneas:** 304, 314, 340-342, 369

**Problema:**
```tsx
// ❌ INCORRECTO - Línea 304, 314, 340
.from('products')
.select('id, sku_interno, nombre, imagen_principal, precio_sugerido_venta, precio_mayorista, ...')

// ❌ INCORRECTO - Línea 369
costB2B: (productData as any).precio_mayorista || 0,  // ← Precio base
```

**Impacto:** 🔴 CRÍTICO
- Carrito B2B muestra precios incorrectos (sin márgenes)
- Seller ve costos menores a los reales al agregar productos
- Cálculos de totales del carrito son incorrectos
- **Afecta decisiones de compra del seller**

**Corrección:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, imagen_principal, precio_b2b, precio_sugerido_venta, ...')

costB2B: (productData as any).precio_b2b || 0,  // ← Precio con márgenes
```

**Prioridad:** 🔴 CRÍTICA - Segunda prioridad después de B2BCatalogImportDialog

---

#### 3. **cartService.ts** - 🔴 CRÍTICO
**Archivo:** `src/services/cartService.ts`  
**Líneas:** 176

**Problema:**
```tsx
// ❌ INCORRECTO - Línea 176
.from('products')
.select('id')
.eq('sku', skuBase)
```

**Impacto:** 🔴 CRÍTICO
- Servicio core de carrito no distingue contexto B2B vs B2C
- Búsqueda de productos por SKU siempre va a tabla
- **Puede afectar inserción de items con precios incorrectos**

**Corrección:**
```tsx
// ✅ CORRECTO - Agregar parámetro de contexto
async function addToCart(params: AddToCartParams & { context: 'B2B' | 'B2C' }) {
  const table = params.context === 'B2B' 
    ? 'v_productos_con_precio_b2b' 
    : 'products';
  
  const { data: productData } = await supabase
    .from(table)
    .select(params.context === 'B2B' ? 'id, precio_b2b' : 'id, precio_sugerido_venta')
    .eq('sku', skuBase);
}
```

**Prioridad:** 🔴 CRÍTICA - Tercera prioridad

---

#### 4. **useCartMigration.ts** - 🔴 CRÍTICO
**Archivo:** `src/hooks/useCartMigration.ts`  
**Líneas:** 37-38, 73-75

**Problema:**
```tsx
// ❌ INCORRECTO - Línea 37-38
.from('products')
.select('id, sku_interno, nombre, precio_mayorista, moq, stock_fisico, imagen_principal')

// ❌ INCORRECTO - Línea 73-75
unit_price: productData.precio_mayorista,
total_price: quantity * productData.precio_mayorista,
```

**Impacto:** 🔴 CRÍTICO
- Al migrar carrito de localStorage a base de datos, sellers obtienen precios incorrectos
- Todos los items migrados tendrán `unit_price` sin márgenes
- **Afecta migración de datos históricos**

**Corrección:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, sku_interno, nombre, precio_b2b, moq, stock_fisico, imagen_principal')

unit_price: productData.precio_b2b,
total_price: quantity * productData.precio_b2b,
```

**Prioridad:** 🔴 CRÍTICA

---

#### 5. **useProductsB2B.ts** - 🔴 CRÍTICO
**Archivo:** `src/hooks/useProductsB2B.ts`  
**Líneas:** 80, 98-101, 248-249, 379

**Problema:**
```tsx
// ❌ INCORRECTO - Línea 80
.from("products")
.select("*", { count: "exact" })

// ❌ INCORRECTO - Líneas 98-101
query = query.order("precio_mayorista", { ascending: true });
query = query.order("precio_mayorista", { ascending: false });

// ❌ INCORRECTO - Líneas 248-249
const factoryCost = p.precio_mayorista || minVariantPrice || 0;
```

**Impacto:** 🔴 CRÍTICO
- **Hook más importante para catálogo B2B**
- Consulta tabla directa y luego calcula precios manualmente en JavaScript
- Duplica lógica que ya existe en la vista SQL
- **Performance:** Cálculos deberían estar en base de datos
- **Mantenibilidad:** Dos lugares con lógica de pricing

**Corrección:**
```tsx
// ✅ CORRECTO
.from("v_productos_con_precio_b2b")
.select("*", { count: "exact" })

// Ordenar por precio_b2b de la vista (ya calculado)
query = query.order("precio_b2b", { ascending: true });

// Usar precio de la vista
const factoryCost = p.precio_b2b || 0;
```

**Prioridad:** 🔴 CRÍTICA - Refactorización importante

---

#### 6. **useBuyerOrders.ts** - 🔴 CRÍTICO
**Archivo:** `src/hooks/useBuyerOrders.ts`  
**Líneas:** 157

**Problema:**
```tsx
// ❌ INCORRECTO
.from('products')
.select('...')
```

**Impacto:** 🔴 CRÍTICO
- Al mostrar detalles de pedidos, puede mostrar precios incorrectos

**Prioridad:** 🔴 CRÍTICA

---

#### 🟡 **GRUPO 2: HEADERS Y BÚSQUEDAS**

---

#### 7. **SellerMobileHeader.tsx** - 🟡 MEDIO
**Archivo:** `src/components/seller/SellerMobileHeader.tsx`  
**Líneas:** 142-143, 406

**Problema:**
```tsx
// ❌ INCORRECTO - Línea 142
.from("products")
.select("id, nombre, sku_interno, imagen_principal, precio_mayorista, descripcion_corta")

// ❌ INCORRECTO - Línea 406 (UI)
<p className="text-sm font-bold text-green-600">
  ${product.precio_mayorista.toFixed(2)}
</p>
```

**Impacto:** 🟡 MEDIO
- Búsqueda mobile muestra `precio_mayorista` (precio base sin márgenes)
- Seller ve precios más bajos en búsqueda que en detalle del producto
- **Inconsistencia UX:** Precio en búsqueda ≠ precio real de compra

**Corrección:**
```tsx
// ✅ CORRECTO
.from("v_productos_con_precio_b2b")
.select("id, nombre, sku_interno, imagen_principal, precio_b2b, descripcion_corta")

<p>${product.precio_b2b.toFixed(2)}</p>
```

**Prioridad:** 🟡 MEDIA - Después de correcciones críticas

---

#### 8. **SellerDesktopHeader.tsx** - 🟡 MEDIO
**Archivo:** `src/components/seller/SellerDesktopHeader.tsx`  
**Líneas:** 157-158, 436

**Problema:** Idéntico a SellerMobileHeader  
**Impacto:** 🟡 MEDIO  
**Prioridad:** 🟡 MEDIA

---

#### 9. **GlobalMobileHeader.tsx** - 🟡 MEDIO
**Archivo:** `src/components/layout/GlobalMobileHeader.tsx`  
**Líneas:** 169

**Problema:**
```tsx
// ❌ INCORRECTO
.from("products")
.select("id, nombre, sku_interno, imagen_principal, precio_mayorista, descripcion_corta")
```

**Impacto:** 🟡 MEDIO
- Búsqueda global puede mostrar precios incorrectos según contexto del usuario

**Corrección:**
```tsx
// ✅ CORRECTO - Detectar contexto del usuario
const table = isB2BUser ? 'v_productos_con_precio_b2b' : 'products';
const priceField = isB2BUser ? 'precio_b2b' : 'precio_sugerido_venta';

.from(table)
.select(`id, nombre, sku_interno, imagen_principal, ${priceField}, descripcion_corta`)
```

**Prioridad:** 🟡 MEDIA

---

#### 🟡 **GRUPO 3: PÁGINAS PÚBLICAS - EXPOSICIÓN DE PRECIOS B2B**

---

#### 10. **TrendsPage.tsx** - 🟡 MEDIO
**Archivo:** `src/pages/TrendsPage.tsx`  
**Líneas:** 59, 73, 79, 81, 143

**Problema:**
```tsx
// ❌ INCORRECTO - Múltiples líneas
Math.max(...trendingProducts.map(p => p.precio_sugerido_venta || p.precio_mayorista || 0), 1000);
const price = p.precio_sugerido_venta || p.precio_mayorista;
precio: p.precio_sugerido_venta || p.precio_mayorista,
```

**Impacto:** 🟡 MEDIO
- **Problema de seguridad:** Página pública expone `precio_mayorista` (precio B2B) a TODOS los usuarios
- Clientes finales pueden ver precios de compra de sellers
- Fallback a `precio_mayorista` cuando no hay `precio_sugerido_venta`

**Corrección Inteligente (Estrategia de Conversión):**
```tsx
// ✅ CORRECTO - Mostrar precio B2B SOLO a sellers/admins como incentivo
const { user } = useAuthStore();
const isSeller = user?.role === 'seller' || user?.role === 'admin';

// Obtener precios según rol
const { data: products } = await supabase
  .from(isSeller ? 'v_productos_con_precio_b2b' : 'products')
  .select(isSeller 
    ? 'id, nombre, precio_sugerido_venta, precio_b2b, imagen_principal, ...'
    : 'id, nombre, precio_sugerido_venta, imagen_principal, ...'
  );

// En UI - Mostrar margen potencial solo a sellers
{isSeller && product.precio_b2b && (
  <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
    <p className="text-xs text-green-700 font-semibold">
      💰 Tu precio de compra B2B: ${product.precio_b2b.toFixed(2)}
    </p>
    <p clPVP sugerido: ${product.precio_sugerido_venta.toFixed(2)}
    </p>
    <p className="text-xs text-green-600 font-semibold">
      🎯 Margen potencial: ${(product.precio_sugerido_venta - product.precio_b2b).toFixed(2)} 
      ({(((product.precio_sugerido_venta - product.precio_b2b) / product.precio_b2b) * 100).toFixed(0)}%)
    </p>
    <p className="text-[10px] text-gray-500 mt-1">
      * PVP es el precio que tú configurarías para tus clientes
      ({(((product.precio_sugerido_venta - product.precio_b2b) / product.precio_b2b) * 100).toFixed(0)}%)
    </p>
  </div>
)}

// Para clientes finales: solo PVP
const price = p.precio_sugerido_venta || 0;
```
- ✅ **Claridad:** Muestra precio_b2b (compra) vs PVP sugerido (venta)

**Beneficios de este enfoque:**
- ✅ **Motivación de sellers:** Ven oportunidad de ganancia inmediata
- ✅ **Conversión:** Incentiva a importar productos al catálogo
- ✅ **Seguridad:** Solo usuarios autenticados como sellers ven precios B2B
- ✅ **UX diferenciada:** Sellers tienen vista mejorada con info de negocio

**Prioridad:** 🟡 MEDIA - Problema de seguridad + oportunidad de conversión

---

#### 11. **CategoryProductsPage.tsx** - 🟡 MEDIO
**Archivo:** `src/pages/CategoryProductsPage.tsx`  
**Líneas:** 224-225, 299-300

**Problema:**
```tsx
// ❌ INCORRECTO
priceB2B: p.precio_mayorista ?? price,
pvp: p.precio_sugerido_venta || price,
```

**Impacto:** 🟡 MEDIO
- Similar a TrendsPage
- Expone `priceB2B` (precio_mayorista) en contexto público SIN validar rol
- **Campo `priceB2B` debería mostrarse SOLO a sellers/admins**

**Corrección:**
```tsx
// ✅ CORRECTO - Condicional por rol
const { user } = useAuthStore();
const isSeller = user?.role === 'seller' || user?.role === 'admin';

// En ProductCard component
<ProductCard
  pvp={p.precio_sugerido_venta}
  priceB2B={isSeller ? p.precio_b2b : undefined}  // Solo sellers ven precio B2B
  showMargin={isSeller}  // Mostrar cálculo de margen
/>
```

**Prioridad:** 🟡 MEDIA

---

#### 12. **useTrendingProducts.ts** - 🟡 MEDIO
**Archivo:** `src/hooks/useTrendingProducts.ts`  
**Líneas:** 30, 43

**Problema:**
```tsx sin filtro por rol
- Consumers del hook usan el fallback `precio_mayorista`

**Corrección:**
```tsx
// ✅ CORRECTO - Hook con parámetro de rol
export const useTrendingProducts = (userRole?: 'seller' | 'admin' | 'buyer' | 'client') => {
  const isSeller = userRole === 'seller' || userRole === 'admin';
  
  const query = supabase
    .from(isSeller ? 'v_productos_con_precio_b2b' : 'products')
    .select(isSeller 
      ? 'id, nombre, precio_sugerido_venta, precio_b2b, imagen_principal, ...'
      : 'id, nombre, precio_sugerido_venta, imagen_principal, ...'
    );
  
  return { products, isSeller };
};
**Corrección:**
```tsx
// ✅ CORRECTO
// Si es para B2C: solo select precio_sugerido_venta
.select("id, nombre, precio_sugerido_venta, imagen_principal, categoria_id, sku_interno, stock_status")

// Si es para B2B: usar vista v_productos_con_precio_b2b
```

**Prioridad:** 🟡 MEDIA

---

#### 13. **useTrendingCategories.ts** - 🟡 MEDIO
**Archivo:** `src/hooks/useTrendingCategories.ts`  
**Líneas:** 44, 73

**Problema:** Similar a useTrendingProducts  
**Impacto:** 🟡 MEDIO  
**Prioridad:** 🟡 MEDIA

---

#### 🟢 **GRUPO 4: HOOKS COMPLEMENTARIOS - CONSISTENCIA**

---

#### 14. **useWishlist.ts** - 🟡 MEDIO
**Archivo:** `src/hooks/useWishlist.ts`  
**Líneas:** 73, 117

**Problema:**
```tsx
// ❌ INCORRECTO - Línea 73
products:product_id (
  id,
  nombre,
  precio_mayorista,  // ← Debería ser desde vista
  imagen_principal,
  sku_interno,
  moq
)

// ❌ INCORRECTO - Línea 117
price: isB2B ? product?.precio_mayorista : catalog?.precio_venta || 0,
```

**Impacto:** 🟡 MEDIO
- Wishlist B2B muestra precios incorrectos
- Usuario guarda productos con precio base en favoritos

**Corrección:**
```tsx
// ✅ CORRECTO - Join con vista en lugar de tabla
// Modificar query para usar vista cuando type='B2B'
price: isB2B ? product?.precio_b2b : catalog?.precio_venta || 0,
```

**Prioridad:** 🟡 MEDIA

---

#### 15. **useB2BCartLogistics.ts** - 🟢 BAJO
**Archivo:** `src/hooks/useB2BCartLogistics.ts`  
**Líneas:** 72-73

**Problema:**
```tsx
// ❌ INCORRECTO
.from('products')
.select('id, precio_mayorista, categoria_id, peso_kg')
```

**Impacto:** 🟢 BAJO
- Solo consulta datos de logística (peso, dimensiones)
- Pero usa `precio_mayorista` en cálculo de `factoryCost` (línea 142)
- **No crítico pero inconsistente**

**Corrección:**
```tsx
// ✅ CORRECTO
.from('v_productos_con_precio_b2b')
.select('id, precio_b2b, categoria_id, peso_kg')

// Línea 142
const factoryCost = product?.precio_b2b || item.precioB2B;
```

**Prioridad:** 🟢 BAJA - Consistencia

---

#### 16. **useB2BCartSupabase.ts** - 🟢 BAJO
**Archivo:** `src/hooks/useB2BCartSupabase.ts`  
**Líneas:** 80

**Problema:** Similar a useB2BCartLogistics  
**Impacto:** 🟢 BAJO  
**Prioridad:** 🟢 BAJA

---

#### 17. **useSmartProductGrouper.ts** - 🟡 MEDIO
**Archivo:** `src/hooks/useSmartProductGrouper.ts`  
**Líneas:** 152, 377, 386

**Problema:**
```tsx
// ❌ INCORRECTO
.from('products')
.select('...')

// Línea 386
precio_mayorista: b2bPrice,
```

**Impacto:** 🟡 MEDIO
- Hook para agrupar productos usa tabla directa

**Prioridad:** 🟡 MEDIA

---

### ✅ USO CORRECTO ENCONTRADO

#### ✅ **ARCHIVOS CON IMPLEMENTACIÓN CORRECTA DE VISTAS**

---

#### 1. **ProductPage.tsx** - ✅ PERFECTO
**Archivo:** `src/pages/ProductPage.tsx`  
**Líneas:** 120, 131, 139-140

```tsx
// ✅ CORRECTO
const { data: b2bProduct } = await supabase
  .from("v_productos_con_precio_b2b")
  .select(`
    *,
    category:categories!products_categoria_id_fkey(id, name, slug)
  `)
  .eq("id", productId)
  .single();

// ✅ CORRECTO - Mapeo de datos
precio_venta: b2bProduct.precio_b2b,  // Usar precio de vista
precio_mayorista: b2bProduct.costo_base_excel,
precio_sugerido_venta: b2bProduct.precio_b2b,
```

**Estado:** ✅ Implementación perfecta  
**Nota:** Este archivo es el **ejemplo de referencia** para otros

---

#### 2. **AdminCatalogo.tsx** - ✅ CORRECTO
**Archivo:** `src/pages/admin/AdminCatalogo.tsx`  
**Líneas:** 43-48

```tsx
// ✅ CORRECTO - Admin consulta precios dinámicos para mostrar
const { data } = await supabase
  .from('v_productos_con_precio_b2b')
  .select('id, precio_b2b');

const priceMap = data.reduce((acc, item) => {
  acc[item.id] = item.precio_b2b;
  return acc;
}, {});
```

**Estado:** ✅ Correcto  
**Nota:** Admin consulta vista para ver precios dinámicos, pero opera sobre tabla

---

#### 3. **useSellerCatalog.ts** - ✅ CORRECTO
**Archivo:** `src/hooks/useSellerCatalog.ts`  
**Líneas:** 62, 68, 92

```tsx
// ✅ CORRECTO
const { data: productsData } = await supabase
  .from('v_productos_con_precio_b2b')
  .select(`
    id,
    sku_interno,
    nombre,
    precio_b2b,
    descripcion_corta,
    imagen_principal,
    moq,
    categoria_id,
    ...
  `);

// ✅ CORRECTO - Mapeo
precioVenta: Number(product.precio_b2b) || 0,
```

**Estado:** ✅ Implementación correcta  
**Nota:** Hook principal de catálogo seller - **referencia para otros hooks**

---

#### 4. **VariantDrawer.tsx** - ✅ EXCELENTE
**Archivo:** `src/components/products/VariantDrawer.tsx`  
**Líneas:** 44, 55

```tsx
// ✅ CORRECTO - Usa AMBAS vistas correctamente
const { data: productPrice } = await supabase
  .from('v_productos_con_precio_b2b')
  .select('precio_b2b')
  .eq('id', productId)
  .single();

const { data: variants } = await supabase
  .from('v_variantes_con_precio_b2b')
  .select('id, nombre, precio_adicional, precio_b2b_final, ...')
  .eq('product_id', productId);
```

**Estado:** ✅ Excelente - Usa vistas de productos Y variantes  
**Nota:** Único componente que usa correctamente ambas vistas

---

### ✅ CONTEXTO ADMIN - USO CORRECTO DE TABLA

Los siguientes archivos usan la tabla `products` directamente, **lo cual es CORRECTO** en contexto administrativo:

#### 1. **useCatalog.tsx** (Admin CRUD)
- **Archivo:** `src/hooks/useCatalog.tsx`
- **Líneas:** 63, 97, 148, 172, 194, 227, 250, 269
- **Uso:** Operaciones CRUD del catálogo admin (create, update, delete)
- **Estado:** ✅ CORRECTO - Admin opera directamente sobre tabla

#### 2. **ProductEditDialog.tsx & ProductFormDialog.tsx**
- **Archivos:** `src/components/catalog/ProductEditDialog.tsx`, `ProductFormDialog.tsx`
- **Uso:** Edición/creación de productos desde admin
- **Estado:** ✅ CORRECTO - Admin modifica tabla directamente

#### 3. **BulkPriceUpdateDialog.tsx**
- **Archivo:** `src/components/catalog/BulkPriceUpdateDialog.tsx`
- **Línea:** 125
- **Uso:** Actualización masiva de precios por admin
- **Estado:** ✅ CORRECTO - Admin actualiza tabla

#### 4. **AdminMarketsPage.tsx**
- **Archivo:** `src/pages/admin/AdminMarketsPage.tsx`
- **Línea:** 265
- **Uso:** Admin gestiona mercados y márgenes
- **Estado:** ✅ CORRECTO

#### 5. **services/api/products.ts** (API)
- **Archivo:** `src/services/api/products.ts`
- **Líneas:** 25, 51, 83, 110
- **Uso:** API de productos (CRUD básico)
- **Estado:** ✅ CORRECTO para CRUD
- **⚠️ ADVERTENCIA:** DEBE filtrar `precio_b2b` y `moq` para clientes B2C (ver comentarios en líneas 6, 40)

#### 6. **services/api/imageSearch.ts**
- **Archivo:** `src/services/api/imageSearch.ts`
- **Línea:** 57
- **Uso:** Búsqueda por imagen (admin)
- **Estado:** ✅ CORRECTO

#### 7. **useProductEmbeddings.ts** (ML)
- **Archivo:** `src/hooks/useProductEmbeddings.ts`
- **Líneas:** 38, 89, 132, 138
- **Uso:** Generación de embeddings para búsqueda semántica
- **Estado:** ✅ CORRECTO - Opera sobre tabla para ML

#### 8. **useProducts.ts** (General)
- **Archivo:** `src/hooks/useProducts.ts`
- **Líneas:** 10, 27, 46, 68, 86
- **Uso:** Hook genérico de productos
- **Estado:** ⚠️ **REVISAR** - Depende del contexto (B2B vs B2C vs Admin)
- **Recomendación:** Agregar parámetro de contexto o crear hooks específicos

---

## 📊 ANÁLISIS COMPARATIVO: TABLA vs VISTA

### Cuándo usar `products` (tabla):
✅ **CORRECTO:**
- Operaciones CRUD desde admin
- Actualizaciones de `precio_mayorista_base`
- Gestión de catálogo (crear, editar, eliminar)
- Generación de embeddings y ML
- Procesos batch/internos

❌ **INCORRECTO:**
- Consultas desde contexto seller
- Mostrar precios de compra B2B
- Cálculos de costos en carrito B2B

### Cuándo usar `v_productos_con_precio_b2b` (vista):
✅ **OBLIGATusar con validación de rol:
⚠️ **CONDICIONAL POR ROL:**
- **Páginas públicas B2C:** 
  - Clientes finales: solo `precio_sugerido_venta`
  - Sellers/Admins: `precio_sugerido_venta` + `precio_b2b` (como incentivo de venta)
- **NUNCA** exponer `precio_mayorista_base` o `precio_b2b` a clientes finales (buyers/guests)
- **SIEMPRE** validar rol de usuario antes de exponer precios B2B
// PVP es lo que el SELLER cobraría a sus clientes:
    pvpSugerido: precio_sugerido_venta,  // Precio de VENTA sugerido
    
    // precio_b2b es lo que el SELLER paga al admin:
    precioCompraB2B: precio_b2b,  // Precio de COMPRA del seller
    
    // Margen del seller (diferencia entre lo que cobra y lo que paga):
    margenPotencial: precio_sugerido_venta - precio_b2b,
    porcentajeMargen: ((precio_sugerido_venta - precio_b2b) / precio_b2b) * 100
  };
}

// ⚠️ IMPORTANTE: PVP ≠ precio_b2b
// PVP = seller_catalog.precio_venta (lo que seller cobra)
// precio_b2b = lo que seller pagaf (userRole === 'seller' || userRole === 'admin') {
  return {
    pvp: precio_sugerido_venta,
    precioCompraB2B: precio_b2b,  // Incentivo
    margenPotencial: precio_sugerido_venta - precio_b2b,
    porcentajeMargen: ((precio_sugerido_venta - precio_b2b) / precio_b2b) * 100
  };
}
```
- Búsquedas de productos para sellers
- Cálculos de costos, márgenes y logística

### Cuándo NO usar ninguno directamente:
❌ **PROHIBIDO:**
- Páginas públicas B2C: solo `precio_sugerido_venta`
- **NUNCA** exponer `precio_mayorista_base` o `precio_b2b` a clientes finales
- Evitar fallbacks a `precio_mayorista` en contexto público

---

## ✅ LISTA DE TAREAS COMPLETA

### 🔴 FASE 1: BASE DE DATOS (PRIORIDAD MÁXIMA)

- [ ] **Tarea 1.1:** Crear migración para agregar `default_markup_multiplier` a `categories`
  - **Archivo:** `supabase/migrations/20260204_add_category_markup.sql`
  - **Valor por defecto:** 4.0 (400% markup)
  - **Comando:**
    ```sql
    ALTER TABLE categories 
    ADD COLUMN IF NOT EXISTS default_markup_multiplier NUMERIC DEFAULT 4.0;
    ```

- [ ] **Tarea 1.2:** Crear vista `v_product_max_pvp` para PVP de otros sellers
  - **Archivo:** `supabase/migrations/20260204_create_pvp_view.sql`
  - **Propósito:** Obtener MAX, MIN, AVG de PVPs por producto
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

- [ ] **Tarea 1.3:** Crear función `calculate_suggested_pvp(product_id, market_id)`
  - **Archivo:** `supabase/migrations/20260204_suggested_pvp_function.sql`
  - **Lógica:**
    ```sql
    CREATE OR REPLACE FUNCTION calculate_suggested_pvp(
      p_product_id UUID,
      p_market_id UUID DEFAULT NULL
    ) RETURNS NUMERIC AS $$
    DECLARE
      v_precio_sugerido NUMERIC;
      v_precio_b2b NUMERIC;
      v_max_pvp NUMERIC;
      v_markup_multiplier NUMERIC;
    BEGIN
      -- 1. Si existe precio_sugerido_venta en products, usar ese
      SELECT precio_sugerido_venta INTO v_precio_sugerido
      FROM products WHERE id = p_product_id;
      
      IF v_precio_sugerido IS NOT NULL AND v_precio_sugerido > 0 THEN
        RETURN v_precio_sugerido;
      END IF;
      
      -- 2. Si no, buscar PVP más alto de otros sellers
      SELECT max_pvp INTO v_max_pvp
      FROM v_product_max_pvp WHERE product_id = p_product_id;
      
      IF v_max_pvp IS NOT NULL AND v_max_pvp > 0 THEN
        RETURN v_max_pvp;
      END IF;
      
      -- 3. Si no hay otros sellers, calcular con margen de categoría
      SELECT vp.precio_b2b, c.default_markup_multiplier
      INTO v_precio_b2b, v_markup_multiplier
      FROM v_productos_con_precio_b2b vp
      JOIN products p ON p.id = vp.id
      JOIN categories c ON c.id = p.categoria_id
      WHERE vp.id = p_product_id;
      
      IF v_precio_b2b IS NOT NULL AND v_markup_multiplier IS NOT NULL THEN
        RETURN ROUND(v_precio_b2b * v_markup_multiplier, 2);
      END IF;
      
      -- Fallback: 4x el precio B2B
      RETURN ROUND(COALESCE(v_precio_b2b, 0) * 4, 2);
    END;
    $$ LANGUAGE plpgsql;
    ```

- [ ] **Tarea 1.4:** Script de migración de datos existentes
  - **Archivo:** `supabase/migrations/20260204_migrate_seller_prices.sql`
  - **Propósito:** Actualizar `seller_catalog.precio_costo` con `precio_b2b` correcto
  - **SQL:**
    ```sql
    -- Actualizar precio_costo de productos ya importados
    UPDATE seller_catalog sc
    SET precio_costo = vp.precio_b2b
    FROM v_productos_con_precio_b2b vp
    WHERE sc.product_id = vp.id
      AND sc.precio_costo != vp.precio_b2b;
    ```

**Estimación FASE 1:** 2-3 horas  
**Dependencias:** Ninguna - Ejecutar primero

---

### 🔴 FASE 2: CORRECCIONES CRÍTICAS (PRIORIDAD ALTA)

- [ ] **Tarea 2.1:** Corregir `B2BCatalogImportDialog.tsx`
  - **Archivo:** `src/components/seller/B2BCatalogImportDialog.tsx`
  - **Líneas:** 49-117
  - **Cambios:**
    1. Línea 49: `.from('v_productos_con_precio_b2b')`
    2. Línea 50: Agregar `precio_b2b` al select, remover `precio_mayorista`
    3. Línea 116: `precio_costo: product.precio_b2b`
    4. Línea 117: Implementar llamada a `calculate_suggested_pvp()` o fallback
  - **Validación:** Importar producto y verificar que `precio_costo` = `precio_b2b` de vista
  - **Testing:** Test de importación con diferentes productos y mercados

- [ ] **Tarea 2.2:** Corregir `SellerCartPage.tsx`
  - **Archivo:** `src/pages/seller/SellerCartPage.tsx`
  - **Líneas:** 304, 314, 340-342, 369
  - **Cambios:**
    1. Todas las queries: `.from('v_productos_con_precio_b2b')`
    2. Línea 342: `precio_b2b` en select (remover `precio_mayorista`)
    3. Línea 369: `costB2B: productData.precio_b2b`
  - **Validación:** Agregar producto al carrito y verificar precio mostrado
  - **Testing:** Verificar cálculos de totales

- [ ] **Tarea 2.3:** Corregir `cartService.ts`
  - **Archivo:** `src/services/cartService.ts`
  - **Línea:** 176
  - **Cambios:**
    1. Agregar parámetro `context: 'B2B' | 'B2C'` a `addToCart`
    2. Condicional para tabla vs vista según contexto
    3. Usar campo correcto de precio según contexto
  - **Validación:** Test de agregar producto en ambos contextos

- [ ] **Tarea 2.4:** Corregir `useCartMigration.ts`
  - **Archivo:** `src/hooks/useCartMigration.ts`
  - **Líneas:** 37-38, 73-75
  - **Cambios:** Similar a 2.2
  - **Validación:** Migrar carrito y verificar precios

- [ ] **Tarea 2.5:** Refactorizar `useProductsB2B.ts`
  - **Archivo:** `src/hooks/useProductsB2B.ts`
  - **Líneas:** 80, 98-101, 248-249, 315-316, 379
  - **Cambios:**
    1. Cambiar query base a vista
    2. Remover cálculos manuales de precio (ya en vista)
    3. Ordenar por `precio_b2b` de vista
    4. Usar `precio_b2b` directamente, no calcular
  - **Impacto:** Simplifica lógica, mejora performance
  - **Testing:** Verificar ordenamiento, filtros, paginación

- [ ] **Tarea 2.6:** Corregir `useBuyerOrders.ts`
  - **Archivo:** `src/hooks/useBuyerOrders.ts`
  - **Línea:** 157
  - **Cambios:** Usar vista para mostrar detalles de pedidos

**Estimación FASE 2:** 5-6 horas  
**Dependencias:** FASE 1 debe estar completa

---
 con estrategia de conversión
  - **Archivo:** `src/pages/TrendsPage.tsx`
  - **Líneas:** 59, 73, 79, 81, 143
  - **Cambios:**
    1. Obtener rol de usuario desde `useAuthStore`
    2. Si es seller/admin: consultar `v_productos_con_precio_b2b` e incluir `precio_b2b`
    3. Si es cliente: consultar solo `products` con `precio_sugerido_venta`
    4. Crear componente `SellerMarginBadge` para mostrar margen potencial
    5. Integrar badge solo cuando `isSeller && precio_b2b`
  - **Componente nuevo:**
    ```tsx
    // src/components/products/SellerMarginBadge.tsx
    interface Props {
      pvp: number;
      precioB2B: number;
    }
    export const SellerMarginBadge = ({ pvp, precioB2B }: Props) => {
      const margen = pvp - precioB2B;
      const porcentaje = ((margen / precioB2B) * 100).toFixed(0);
      return (
        <div clas
    1. Validar rol de usuario
    2. Incluir `priceB2B` solo para sellers/admins
    3. Integrar `SellerMarginBadge` en ProductCard cuando corresponda border-green-200">
          <p className="text-xs text-green-700 font-semibold">
            💰 Tu compra: ${precioB2B.toFixed(2)}
          </p>
          <p className="text-xs text-green-600">
            📈 Margen: ${margen.toFixed(2)} ({porcentaje}%)
          </p>
        </div>
      );
    };
    ```
  - **Impacto:** Seguridad + Conversión - Proteger precios B2B de clientes, incentivar sellers
- [ ] **Tarea 3.2:** Corregir `SellerDesktopHeader.tsx`
  - **Archivo:** `src/components/seller/SellerDesktopHeader.tsx`
  - **Líneas:** 157-158, 436
  - **Cambios:** Idéntico a 3.1

- [ ] **Tarea 3.3:** Corregir `GlobalMobileHeader.tsx`
  - **Archivo:** 
    1. Agregar parámetro `userRole` al hook
    2. Consultar tabla vs vista según rol
    3. Retornar `isSeller` flag para que componentes sepan qué mostrartsx`
  - **Línea:** 169
  - **Cambios:** Detectar contexto de usuario (B2B vs B2C), usar tabla/vista correspondiente

- [ ] **Tarea 4.5:** Crear componente `SellerMarginBadge.tsx` (nuevo)
  - **Archivo:** `src/components/products/SellerMarginBadge.tsx`
  - **Propósito:** Badge reutilizable para mostrar margen potencial a sellers
  - **Props:** `pvp: number, precioB2B: number`
  - **Diseño:** Fondo verde claro, iconos 💰 y 📈, resalta porcentaje de margen

**Estimación FASE 4:** 3-4 horas (incluye componente nuevo)  
**Impacto:** Seguridad + Conversión + UX mejorada para seller
---

### 🟡 FASE 4: PÁGINAS PÚBLICAS - SEGURIDAD (PRIORIDAD MEDIA)

- [ ] **Tarea 4.1:** Corregir `TrendsPage.tsx`
  - **Archivo:** `src/pages/TrendsPage.tsx`
  - **Líneas:** 59, 73, 79, 81, 143
  - **Cambios:**
    1. Remover fallback a `precio_mayorista`
    2. Usar solo `precio_sugerido_venta`
    3. Filtrar productos sin precio sugerido
  - **Impacto:** Seguridad - No exponer precios B2B

- [ ] **Tarea 4.2:** Corregir `CategoryProductsPage.tsx`
  - **Archivo:** `src/pages/CategoryProductsPage.tsx`
  - **Líneas:** 224-225, 299-300
  - **Cambios:** No incluir `priceB2B` en contexto B2C

- [ ] **Tarea 4.3:** Corregir `useTrendingProducts.ts`
  - **Archivo:** `src/hooks/useTrendingProducts.ts`
  - **Líneas:** 30, 43
  - **Cambios:** No seleccionar `precio_mayorista` para B2C

- [ ] **Tarea 4.4:** Corregir `useTrendingCategories.ts`
  - **Archivo:** `src/hooks/useTrendingCategories.ts`
  - **Líneas:** 44, 73
  - **Cambios:** Similar a 4.3

**Estimación FASE 4:** 2-3 horas  
**Impacto:** Seguridad y confidencialidad de datos

---

### 🟢 FASE 5: HOOKS COMPLEMENTARIOS (PRIORIDAD BAJA)

- [ ] **Tarea 5.1:** Crear hook `usePricing.ts`
  - **Archivo:** `src/hooks/usePricing.ts` (nuevo)
  - **Funciones:**
    ```typescript
    export const usePricing = () => {
      const getSuggestedPVP = async (productId: string, marketId?: string) => {
        const { data } = await supabase.rpc('calculate_suggested_pvp', {
          p_product_id: productId,
          p_market_id: marketId
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

- [ ] **Tarea 5.2:** Corregir `useWishlist.ts`
  - **Archivo:** `src/hooks/useWishlist.ts`
  - **Líneas:** 73, 117
  - **Cambios:** Join con vista en lugar de tabla para items B2B

- [ ] **Tarea 5.3:** Corregir `useB2BCartLogistics.ts`
  - **Archivo:** `src/hooks/useB2BCartLogistics.ts`
  - **Líneas:** 72-73, 142
  - **Cambios:** Usar vista, `precio_b2b` para `factoryCost`

- [ ] **Tarea 5.4:** Corregir `useB2BCartSupabase.ts`
  - **Archivo:** `src/hooks/useB2BCartSupabase.ts`
  - **Línea:** 80
  - **Cambios:** Similar a 5.3

- [ ] **Tarea 5.5:** Corregir `useSmartProductGrouper.ts`
  - **Archivo:** `src/hooks/useSmartProductGrouper.ts`
  - **Líneas:** 152, 377, 386
  - **Cambios:** Usar vista según contexto

**Estimación FASE 5:** 3-4 horas
**Precio de Compra B2B:** $X (precio_b2b - lo que tú PAGAS)
    - **PVP Sugerido:** $Y (precio_venta - lo que tú COBRARÍAS a tus clientes)
    - **Otros sellers venden a:** $Z (max/min/avg de PVPs en el mercado)
    - **Tu margen potencial:** $M (Y% = diferencia entre PVP y precio_b2b)
  - **Aclaración visual:**
    ```
    ┌──────────────────────────────────────┐
    │ Tú PAGAS (precio_b2b): $15          │ ← Precio de compra
    │ Tú COBRAS (PVP): $30                │ ← Precio de venta
    │ Tu GANANCIA: $15 (100%)             │ ← Margen
    └──────────────────────────────────────┘
    ```PCIONAL)

- [ ] **Tarea 6.1:** Crear componente `PricingBreakdown.tsx`
  - **Archivo:** `src/components/pricing/PricingBreakdown.tsx` (nuevo)
  - **Propósito:** Mostrar desglose visual de precios
  - **Props:** `productId`, `marketId`
  - **Muestra:**
    - Precio de Compra B2B: $X
    - PVP Sugerido: $Y (con fuente: admin/market/calculado)
    - Otros sellers venden a: $Z (max/min/avg)
    - Tu margen potencial: $M (Y%)

- [ ] **Tarea 6.2:** Integrar `PricingBreakdown` en `B2BCatalogImportDialog`
  - Ubicación: Antes del botón "Importar"
  - Muestra info de pricing para productos seleccionados

- [ ] **Tarea 6.3:** Actualizar labels en toda la UI
  - "Precio Mayorista" → "Precio de Compra B2B"
  - Agregar "PVP Sugerido" donde corresponda
  - Clarificar tooltips

**Estimación FASE 6:** 3-4 horas

---

### 🟢 FASE 7: TESTING Y VALIDACIÓN

- [ ] **Tarea 7.1:** Tests de función `calculate_suggested_pvp`
  - Escenario 1: Con `precio_sugerido_venta` configurado
  - Escenario 2: Sin precio sugerido, con otros sellers (usar MAX)
  - Escenario 3: Sin precio sugerido, sin otros sellers (usar margen categoría)
  - Escenario 4: Producto nuevo sin configuración (usar 4x)

- [ ] **Tarea 7.2:** Tests de importación de catálogo
  - Verificar `precio_costo` = `precio_b2b` de vista
  - Verificar `precio_venta` calculado correctamente
  - Test con diferentes mercados (márgenes diferentes)

- [ ] **Tarea 7.3:** Tests de carrito B2B
  - Agregar productos al carrito
  - Verificar precios mostrados
  - Verificar cálculos de totales
  - Verificar logística usa precios correctos

- [ ] **Tarea 7.4:** Tests end-to-end
  - Flujo completo: Búsqueda → Detalle → Carrito → Checkout
  - Verificar precios consistentes en todo el flujo
  - Test con usuario seller y usuario cliente

**Estimación FASE 7:** 3-4 horas

---

## 📊 MATRIZ DE PRIORIDADES

### Por Impacto Financiero:
| Archivo | Impacto $ | Prioridad | Fase |
|---------|-----------|-----------|------|
| B2BCatalogImportDialog.tsx | 🔴 ALTO | 1 | FASE 2.1 |
| SellerCartPage.tsx | 🔴 ALTO | 2 | FASE 2.2 |
| cartService.ts | 🔴 ALTO | 3 | FASE 2.3 |
| useCartMigration.ts | 🔴 ALTO | 4 | FASE 2.4 |
| useProductsB2B.ts | 🔴 ALTO | 5 | FASE 2.5 |
| useBuyerOrders.ts | 🔴 MEDIO | 6 | FASE 2.6 |

### Por Impacto UX:
| Archivo | Impacto UX | Prioridad | Fase |
|---------|------------|-----------|------|
| SellerMobileHeader.tsx | 🟡 MEDIO | 7 | FASE 3.1 |
| SellerDesktopHeader.tsx | 🟡 MEDIO | 8 | FASE 3.2 |
| GlobalMobileHeader.tsx | 🟡 MEDIO | 9 | FASE 3.3 |

### Por Seguridad:
| Archivo | Riesgo | Prioridad | Fase |
|---------|--------|-----------|------|
| TrendsPage.tsx | 🟡 MEDIO | 10 | FASE 4.1 |
| CategoryProductsPage.tsx | 🟡 MEDIO | 11 | FASE 4.2 |
| useTrendingProducts.ts | 🟡 MEDIO | 12 | FASE 4.3 |
| useTrendingCategories.ts | 🟡 MEDIO | 13 | FASE 4.4 |

### Por Consistencia:
| Archivo | Importancia | Prioridad | Fase |
|---------|-------------|-----------|------|
| useWishlist.ts | 🟢 BAJA | 14 | FASE 5.2 |
| useB2BCartLogistics.ts | 🟢 BAJA | 15 | FASE 5.3 |
| useB2BCartSupabase.ts | 🟢 BAJA | 16 | FASE 5.4 |
| useSmartProductGrouper.ts | 🟢 BAJA | 17 | FASE 5.5 |

---

## 📈 RESUMEN FINAL

### Estimación Total:
- **FASE 1 (BD):** 2-3 horas
- **FASE 2 (Crítico):** 5-6 horas
- **FASE 3 (Headers):** 2-3 horas
- **FASE 4 (Seguridad):** 2-3 horas
- **FASE 5 (Hooks):** 3-4 horas
- **FASE 6 (UI):** 3-4 horas (opcional)
- **FASE 7 (Testing):** 3-4 horas
- **TOTAL:** **20-27 horas** (incluyendo opcional)
- **MÍNIMO VIABLE:** **11-15 horas** (FASES 1-4)

### Orden de Ejecución Recomendado:
1. ✅ **FASE 1:** Migraciones BD (base para todo)
2. 🔴 **FASE 2:** Correcciones críticas (impacto financiero)
3. 🟡 **FASE 3:** Headers (mejora UX)
4. 🟡 **FASE 4:** Seguridad (confidencialidad)
5. 🟢 **FASE 5:** Consistencia (opcional)
6. 🟢 **FASE 6-7:** UI y testing (opcional)

### Métricas de Éxito:
- ✅ 0% de productos importados con `precio_costo` incorrecto
- ✅ 100% de consultas seller usan vista `v_productos_con_precio_b2b`
- ✅ 0% de exposición de `precio_mayorista` en páginas públicas
- ✅ Tests E2E de flujo B2B pasan al 100%

---

**Fecha de auditoría:** 2026-02-04  
**Estado:** ✅ Auditoría exhaustiva completada  
**Siguiente paso:** Implementar FASE 1 (Migraciones BD)  
**Prioridad global:** 🔴 CRÍTICA - Comenzar inmediatamente

---

## 🔗 REFERENCIAS

- [ARQUITECTURA_PRECIOS_CORREGIDA.md](./ARQUITECTURA_PRECIOS_CORREGIDA.md) - Explicación de arquitectura
- [PLAN_IMPLEMENTACION_PRICING.md](./PLAN_IMPLEMENTACION_PRICING.md) - Plan original
- [AUDITORIA_PRECIO_B2B.md](./AUDITORIA_PRECIO_B2B.md) - Primera auditoría (versión anterior)
