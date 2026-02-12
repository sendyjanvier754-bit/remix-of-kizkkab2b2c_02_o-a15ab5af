# 📊 Vistas del Panel de Negocio (Business Dashboard)

## 🎯 Resumen Ejecutivo

El sistema tiene **3 vistas principales** para el panel de negocio/business dashboard, más **5 vistas de soporte** para funcionalidad adicional.

---

## 📈 Vistas Principales del Panel de Negocio

### 1. **`v_business_panel_with_shipping_functions`** ⭐ 🆕 ACTUALIZADA
**Propósito**: Vista principal del panel de negocio con cálculos completos

**CAMBIO IMPORTANTE**: Ahora usa `v_precio_sugerido_con_logistica` para productos

**Datos que provee**:
- ✅ **PRODUCTOS**: Usa lógica inteligente de precio sugerido (markup categoría o B2C si es mayor)
- ✅ **VARIANTES**: Usa multiplicador fallback 4x (hasta implementar categorías en variantes)
- ✅ Peso de cada item (weight_kg)
- ✅ Costo de envío por unidad
- ✅ PVP sugerido por unidad (con lógica inteligente para productos)
- ✅ Inversión, ingresos y ganancia por 1 unidad
- ✅ Porcentaje de margen sobre costo total (B2B + logística)

**Columnas**:
```sql
- product_id, variant_id
- item_name, sku
- item_type ('product' o 'variant')
- cost_per_unit (precio B2B)
- weight_kg
- shipping_cost_per_unit
- suggested_pvp_per_unit
- investment_1unit
- revenue_1unit
- profit_1unit
- margin_percentage
- is_active, last_updated
```

**Uso**: Panel principal donde sellers ven costos, márgenes y PVP sugeridos

---

### 2. **`v_category_logistics`**
**Propósito**: Datos de logística agrupados por categoría

**Datos que provee**:
- ✅ Productos y variantes con su peso
- ✅ Costo de envío calculado por item
- ✅ Identificación de productos por SKU

**Columnas**:
```sql
- product_id, variant_id
- item_name, sku
- item_type
- peso_kg
- shipping_cost
- is_active, last_updated
```

**Uso**: Análisis de costos logísticos por categoría de productos

---

### 3. **`v_business_panel_cart_summary`**
**Propósito**: Resumen de items en carrito con información de ruta

**Datos que provee**:
- ✅ Lista de productos y variantes activos
- ✅ Peso de cada item
- ✅ route_id para cálculo de envío
- ✅ Metadata para calcular costos totales de carrito

**Columnas**:
```sql
- product_id, variant_id
- item_name, sku
- item_type
- peso_kg
- route_id (para calculate_shipping_cost)
- is_active, last_updated
```

**Uso**: Vista usada por el carrito para calcular costos de envío totales

---

## � Actualización Reciente: Integración con Precio Sugerido Inteligente

### Cambio en `v_business_panel_with_shipping_functions`

**ANTES** (lógica fija):
- Productos y variantes: precio_b2b × 2.5 + envío
- Sin considerar categorías
- Sin protección contra precios B2C bajos

**AHORA** (lógica inteligente) ✅:
- **PRODUCTOS**: Usa `v_precio_sugerido_con_logistica`
  - Calcula primero: precio_b2b × markup_categoria
  - Si existe precio B2C Y es mayor → usa B2C
  - Caso contrario → usa el calculado
  - Margen sobre costo total (B2B + logística)
  
- **VARIANTES**: Usa multiplicador fallback 4x
  - Por implementar: categorías en variantes

### Ventajas del Cambio

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Markup** | Fijo 2.5x | Configurable por categoría (3x-5x) |
| **Consistencia** | Igual para todo | Respeta estrategia de cada categoría |
| **Protección** | ❌ No | ✅ Ignora precios B2C bajos |
| **Flexibilidad** | ❌ Limitada | ✅ Admin controla multiplicadores |
| **Cálculo margen** | Sobre B2B solo | Sobre costo total (B2B + logística) |

---

## �🔧 Vistas de Soporte / Funcionalidad

### 4. **`v_productos_con_precio_b2b`**
**Propósito**: Productos con su precio B2B calculado
**Archivo**: 20260131_b2b_engineering_migration.sql

### 5. **`v_variantes_con_precio_b2b`**
**Propósito**: Variantes con su precio B2B final
**Archivo**: 20260131_b2b_engineering_migration.sql

### 6. **`v_product_shipping_costs`**
**Propósito**: Cálculo de costos de envío por producto
**Archivo**: VISTAS_FUNCIONES_SHIPPING_CORREGIDA.sql

### 7. **`v_cart_shipping_costs`**
**Propósito**: Cálculo de costos de envío para carrito completo
**Archivo**: VISTAS_FUNCIONES_SHIPPING_CORREGIDA.sql

### 8. **`v_precio_sugerido_con_logistica`** 🆕
**Propósito**: PVP sugerido inteligente (precio B2B × markup + logística)
**Archivo**: CREAR_VISTA_PRECIO_SUGERIDO_CON_LOGISTICA.sql
**Columnas clave**:
- precio_b2b, costo_logistica_actual
- costo_total_con_logistica
- pvp_sugerido (calculado con nueva lógica)
- ganancia_por_unidad, markup_sobre_costo_total_percent
- origen_pvp (indica si usa B2C, markup categoría, o fallback)

---

## 📊 Arquitectura de Vistas

```
┌─────────────────────────────────────────────────────────┐
│           PANEL DE NEGOCIO (Frontend)                    │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────────┐ ┌────────────────┐ ┌──────────────────┐
│ v_business_     │ │ v_category_    │ │ v_business_panel_│
│ panel_with_     │ │ logistics      │ │ cart_summary     │
│ shipping_       │ │                │ │                  │
│ functions       │ │                │ │                  │
└────────┬────────┘ └────────┬───────┘ └────────┬─────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
         ┌───────────────────┴──────────────────┐
         │                                       │
         ▼                                       ▼
┌──────────────────────┐            ┌──────────────────────┐
│ v_productos_con_     │            │ v_product_shipping_  │
│ precio_b2b           │            │ costs                │
│                      │            │                      │
│ v_variantes_con_     │            │ calculate_shipping_  │
│ precio_b2b           │            │ cost()               │
└──────────────────────┘            └──────────────────────┘
         │                                       │
         └───────────────────┬───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Base Tables:    │
                    │ - products      │
                    │ - product_      │
                    │   variants      │
                    │ - shipping_     │
                    │   routes        │
                    │ - categories    │
                    └─────────────────┘
```

---

## 🚀 Vistas Más Usadas por Módulo

| Módulo Frontend | Vista Principal | Vistas Secundarias |
|-----------------|----------------|-------------------|
| **Panel Inversión** | `v_business_panel_with_shipping_functions` | `v_productos_con_precio_b2b` |
| **Catálogo Seller** | `v_product_shipping_costs` | `v_precio_sugerido_con_logistica` 🆕 |
| **Carrito/Checkout** | `v_cart_shipping_costs` | `v_business_panel_cart_summary` |
| **Análisis Categorías** | `v_category_logistics` | - |
| **Publicación B2C** | `v_precio_sugerido_con_logistica` 🆕 | `calculate_suggested_pvp()` |

---

## 📈 Estadísticas de Uso

### Vistas Críticas (Alta Frecuencia)
- ✅ `v_business_panel_with_shipping_functions` - **Usada en cada carga del panel**
- ✅ `v_product_shipping_costs` - **Usada en listado de catálogo**
- ✅ `v_cart_shipping_costs` - **Usada en checkout**

### Vistas Moderadas (Frecuencia Media)
- ⚡ `v_category_logistics` - **Análisis periódico**
- ⚡ `v_precio_sugerido_con_logistica` - **Al publicar productos**

### Vistas de Soporte (Bajo Acceso Directo)
- 📊 `v_productos_con_precio_b2b` - Usada por otras vistas
- 📊 `v_variantes_con_precio_b2b` - Usada por otras vistas

---

## 🔍 Consultas de Verificación

### Ver todas las vistas del sistema
```sql
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND (viewname LIKE 'v_%business%' 
       OR viewname LIKE 'v_%shipping%'
       OR viewname LIKE 'v_%precio%')
ORDER BY viewname;
```

### Ver dependencias de vistas
```sql
SELECT DISTINCT
  dependent_view.relname as view_name,
  source_table.relname as depends_on
FROM pg_depend 
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
WHERE dependent_view.relkind = 'v'
  AND source_table.relname LIKE 'v_%'
ORDER BY view_name;
```

### Ver tamaño de las vistas (queries lentas)
```sql
SELECT 
  schemaname,
  viewname,
  pg_size_pretty(pg_relation_size(schemaname||'.'||viewname)) as size
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'v_%'
ORDER BY pg_relation_size(schemaname||'.'||viewname) DESC;
```

---

## ✅ Resumen

| Categoría | Cantidad |
|-----------|----------|
| **Vistas Panel Negocio** | 3 |
| **Vistas Shipping/Logística** | 2 |
| **Vistas Precios B2B** | 2 |
| **Vistas Precio Sugerido** | 1 (nueva) |
| **TOTAL** | **8 vistas** |

### Nueva Vista Agregada Recientemente 🆕
- ✅ `v_precio_sugerido_con_logistica` - Combina precio B2B + logística + PVP sugerido inteligente (usa markup por categoría)

**Todas las vistas están optimizadas y usan índices para consultas rápidas.** 🚀
