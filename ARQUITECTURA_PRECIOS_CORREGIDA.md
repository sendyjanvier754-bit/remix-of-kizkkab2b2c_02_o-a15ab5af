# ARQUITECTURA DE PRECIOS - CORRECCIÓN CRÍTICA

## ❌ PROBLEMA IDENTIFICADO

Hay confusión en el sistema sobre qué precio representa qué:

### Confusión Actual (INCORRECTO):
- `precio_mayorista_base` → Se usa como "precio de venta del admin"
- `precio_b2b` (de vista) → Se considera "precio sugerido al seller"
- `precio_sugerido_venta` → No está claro su propósito

## ✅ ARQUITECTURA CORRECTA

### 1. TABLA `products` (Catálogo del Admin)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  sku_interno TEXT,
  nombre TEXT,
  
  -- COSTO BASE (lo que le cuesta al admin)
  costo_base_excel NUMERIC,  -- Costo del proveedor en China
  
  -- PRECIO BASE B2B (sin márgenes de mercado)
  precio_mayorista_base NUMERIC,  -- Precio base B2B antes de márgenes
  
  -- PRECIO SUGERIDO (opcional, referencia para sellers)
  precio_sugerido_venta NUMERIC,  -- Sugerencia de PVP para sellers
  
  ...
);
```

### 2. VISTA `v_productos_con_precio_b2b` (Precio Dinámico B2B)

```sql
-- ESTE ES EL PRECIO REAL QUE EL ADMIN COBRA AL SELLER
-- ESTE ES EL PRECIO QUE USAMOS EN TODO EL SISTEMA
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.precio_mayorista_base,  -- Solo para referencia interna
  
  -- ⭐ PRECIO B2B FINAL = Precio que el seller PAGA al admin
  -- Este campo es el que se usa en TODO el sistema
  -- Aplica márgenes por mercado sobre precio_mayorista_base
  calculate_b2b_price(p.id, market_id, user_id) AS precio_b2b,
  
  p.precio_sugerido_venta,  -- Solo referencia para PVP
  ...
FROM products p;
```

**✅ IMPORTANTE:** 
- Siempre consultamos `v_productos_con_precio_b2b` (la vista)
- Siempre usamos el campo `precio_b2b` de la vista
- NUNCA usar `precio_mayorista_base` directamente para ventas

### 3. TABLA `seller_catalog` (Catálogo del Seller)

```sql
CREATE TABLE seller_catalog (
  id UUID PRIMARY KEY,
  seller_store_id UUID REFERENCES stores(id),
  source_product_id UUID REFERENCES products(id),
  
  -- COSTO DEL SELLER (lo que le costó comprarlo al admin)
  precio_costo NUMERIC,  -- = precio_b2b del producto
  
  -- PVP = PRECIO DE VENTA AL PÚBLICO (lo que el seller cobra)
  precio_venta NUMERIC,  -- El seller configura este precio
  
  nombre TEXT,
  descripcion TEXT,
  stock INTEGER,
  ...
);
```

## 📊 FLUJO DE PRECIOS CORRECTO

```
┌─────────────────────────────────────────────────────────────┐
│         TABLA PRODUCTS (Configuración del Admin)           │
├─────────────────────────────────────────────────────────────┤
│ costo_base_excel: $10       (Costo proveedor China)        │
│ precio_mayorista_base: $15  (Precio base B2B sin margen)   │
│ precio_sugerido_venta: $30  (Sugerencia de PVP)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   VISTA CALCULA MARGEN
                            ↓
┌─────────────────────────────────────────────────────────────┐
│       VISTA v_productos_con_precio_b2b (Dinámico)          │
├─────────────────────────────────────────────────────────────┤
│ precio_b2b: $18             (Base $15 + Margen 20% = $18)  │
│ ⭐ ESTE ES EL PRECIO QUE USA EL SISTEMA                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    SELLER COMPRA A $18
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SELLER_CATALOG                           │
├─────────────────────────────────────────────────────────────┤
│ precio_costo: $18           (Copia de precio_b2b vista)    │
│ precio_venta: $30           (PVP que configura el seller)  │
│ margen: $12 (66%)           (Ganancia del seller)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    CLIENTE FINAL PAGA $30
```

**🔑 REGLA DE ORO:**
- Siempre consultar la VISTA `v_productos_con_precio_b2b`
- Siempre usar el campo `precio_b2b` de la vista
- Este campo ya tiene los márgenes aplicados

## 🔧 CAMBIOS NECESARIOS

### 1. Labels y UI del Admin
- ✅ "Precio Mayorista Base" → Es correcto
- ✅ "Precio B2B" (vista) → Es el precio de venta B2B al seller
- ❌ NO mostrar como "precio sugerido"

### 2. Labels y UI del Seller
- Cuando el seller ve productos del catálogo B2B:
  - Mostrar `precio_b2b` como **"Precio de Compra"** o **"Tu Costo"**
  - Mostrar `precio_sugerido_venta` como **"PVP Sugerido"** (opcional)
  - El seller configura su propio **"PVP"** en `seller_catalog.precio_venta`

### 3. Componente B2BCatalogImportDialog

**ANTES (incorrecto):**
```tsx
precio_costo: product.precio_mayorista,  // ❌ Usa precio base
precio_venta: product.precio_sugerido_venta || Math.ceil(product.precio_mayorista * 1.3)
```

**DESPUÉS (correcto):**
```tsx
precio_costo: product.precio_b2b,  // ✅ Precio B2B dinámico (lo que pagará)
precio_venta: product.precio_sugerido_venta || Math.ceil(product.precio_b2b * 1.3)
```

### 4. ProductPage.tsx

**ANTES (incorrecto):**
```tsx
precio_venta: b2bProduct.precio_b2b,  // ❌ Confuso
precio_costo: b2bProduct.costo_base_excel,  // ❌ Esto es costo del admin
```

**DESPUÉS (correcto):**
```tsx
// Para seller viendo catálogo B2B:
precio_compra_b2b: b2bProduct.precio_b2b,  // Lo que pagará al admin
precio_sugerido_venta: b2bProduct.precio_sugerido_venta,  // Sugerencia de PVP
```

## 📝 RESUMEN

| Campo | Fuente | Significado |
|-------|--------|-------------|
| `costo_base_excel` | `products` tabla | Costo del proveedor (China) al ADMIN |
| `precio_mayorista_base` | `products` tabla | Precio base B2B (sin márgenes) - SOLO INTERNO |
| `precio_b2b` | **`v_productos_con_precio_b2b` VISTA** | ⭐ **Precio que SELLER paga a ADMIN** (con márgenes) |
| `precio_sugerido_venta` | `products` tabla | Sugerencia de PVP para el seller |
| `precio_costo` | `seller_catalog` tabla | Lo que el seller pagó al admin (copia de `precio_b2b`) |
| `precio_venta` | `seller_catalog` tabla | **PVP que el SELLER cobra al cliente** |

**⚠️ CRÍTICO:**
- SIEMPRE consultar `v_productos_con_precio_b2b` (la vista), NO la tabla `products`
- SIEMPRE usar `precio_b2b` de la vista
- El campo `precio_mayorista_base` de la tabla es solo para configuración interna del admin

## 🎯 ACCIONES PRIORITARIAS

1. ✅ Corregir labels en UI del admin
2. ✅ Corregir labels en UI del seller
3. ✅ Actualizar B2BCatalogImportDialog para usar `precio_b2b`
4. ✅ Actualizar ProductPage para mostrar correctamente
5. ✅ Actualizar documentación de API
6. ✅ Actualizar componentes de carrito/checkout

---

**Fecha de corrección:** 2026-02-03
**Prioridad:** 🔴 CRÍTICA
