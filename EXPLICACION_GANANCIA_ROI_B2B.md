=====================================================
📊 EXPLICACIÓN: Datos de Ganancia y ROI en Tarjetas B2B
=====================================================
Fecha: 2026-02-27

## 🎯 RESUMEN

Las tarjetas de productos B2B muestran dos métricas clave:
- **Ganancia**: Diferencia entre PVP sugerido y precio B2B
- **ROI**: Retorno de inversión en porcentaje

Ejemplo visual:
```html
<div class="flex items-center justify-between mt-1 px-1.5 py-0.5 bg-green-50 rounded text-[10px]">
  <span class="text-green-700 font-medium">Ganancia: +$71.64</span>
  <span class="text-green-600 font-bold">ROI 300%</span>
</div>
```

=====================================================
## 📍 UBICACIÓN DEL CÓDIGO
=====================================================

**Archivo:** src/components/b2b/ProductCardB2B.tsx

**Líneas relevantes:**
- Líneas 36-52: Cálculo de profit y ROI
- Líneas 230-240: Renderizado del banner verde

=====================================================
## 🔢 CÁLCULO DE LOS VALORES
=====================================================

### 1. GANANCIA (Profit)
```typescript
const profit = product.profit_amount ?? 
  ((product.precio_sugerido || 0) - product.precio_b2b);
```

**Fórmula:**
```
Ganancia = PVP Sugerido - Precio B2B
```

**Ejemplo:**
- Precio B2B: $20.00
- PVP Sugerido: $71.64
- **Ganancia: $51.64** ❌ (el ejemplo del usuario muestra $71.64, sugiere que hay algo diferente)

### 2. ROI (Return on Investment)
```typescript
const roiPercent = product.roi_percent ?? 
  (product.precio_b2b > 0 ? (profit / product.precio_b2b) * 100 : 0);
```

**Fórmula:**
```
ROI (%) = (Ganancia / Precio B2B) × 100
```

**Ejemplo con los datos del usuario:**
- Ganancia: $71.64
- Precio B2B: $23.88 (calculado desde ROI 300%)
- **ROI: (71.64 / 23.88) × 100 = 300%** ✅

**O al revés, si ROI es 300% y ganancia es $71.64:**
- ROI 300% significa que ganas 3 veces lo invertido
- Precio B2B = 71.64 / 3 = $23.88
- PVP Sugerido = 23.88 + 71.64 = $95.52

=====================================================
## 📊 ORIGEN DE LOS DATOS
=====================================================

### Fuente Principal: Vista SQL
Los datos vienen de la vista `v_productos_con_precio_b2b`

**Columnas clave:**
```sql
- precio_b2b           -- Precio mayorista
- precio_sugerido      -- PVP recomendado
- profit_amount        -- Ganancia calculada
- roi_percent          -- ROI calculado
- is_market_synced     -- Si usa precio del mercado
- pvp_source           -- De dónde viene el precio (market/admin/calculated)
```

### ¿De dónde viene precio_sugerido?

**3 Fuentes posibles (en orden de prioridad):**

1. **Mercado B2C (is_market_synced = true)**
   - Tabla: `b2c_market_prices`
   - Campo: `max_price`
   - Lógica: Precio máximo que otros sellers B2C usan para el mismo producto
   - Badge verde: "✓ Precio máximo del mercado B2C"

2. **Configuración Admin (pvp_source = 'admin')**
   - Tabla: `pricing_configs`
   - Campo: `suggested_pvp`
   - Lógica: Admin configura manualmente el PVP sugerido
   - Tooltip: "Precio sugerido por administrador"

3. **Cálculo Automático (pvp_source = 'calculated')**
   - Fórmula: `precio_b2b × (1 + margen/100)`
   - Margen por defecto: definido en pricing_configs
   - Tooltip: "Precio calculado (+150% margen)" (ejemplo)

=====================================================
## 🎨 VISUALIZACIÓN EN LA UI
=====================================================

### Banner Verde de Ganancia/ROI
**Condición para mostrar:**
```typescript
{profit > 0 && (
  <div className="flex items-center justify-between...">
    <span>Ganancia: +${profit.toFixed(2)}</span>
    <span>ROI {roiPercent.toFixed(0)}%</span>
  </div>
)}
```

**Se muestra solo si:**
- ✅ profit > 0
- ✅ Hay un precio_sugerido válido
- ✅ Producto tiene datos calculados

### Badge de ROI junto al PVP
**Ubicación:** Línea 210
```tsx
<span className="text-[9px] text-green-700 font-bold bg-green-50 px-1 py-0.5 rounded">
  ROI {roiPercent.toFixed(0)}%
</span>
```

=====================================================
## 🔍 EJEMPLO REAL CON DATOS DEL USUARIO
=====================================================

**Dado:**
- Ganancia mostrada: $71.64
- ROI mostrado: 300%

**Cálculo inverso:**
```
ROI = (Ganancia / Precio B2B) × 100
300 = (71.64 / X) × 100
X = 71.64 / 3
X = $23.88
```

**Por lo tanto:**
- Precio B2B: **$23.88**
- Ganancia: **$71.64**
- PVP Sugerido: **$95.52** ($23.88 + $71.64)
- ROI: **300%**

**Verificación:**
- El seller compra a $23.88
- Puede vender a $95.52
- Gana $71.64 por unidad
- ROI = (71.64 / 23.88) × 100 = 300% ✅

=====================================================
## 📝 QUERIES SQL PARA VERIFICAR
=====================================================

### Ver datos de un producto específico
```sql
SELECT 
  p.id,
  p.sku,
  p.nombre,
  p.precio_b2b,
  p.precio_sugerido,
  p.profit_amount,
  p.roi_percent,
  p.is_market_synced,
  p.pvp_source,
  p.num_b2c_sellers
FROM v_productos_con_precio_b2b p
WHERE p.sku = 'TU_SKU_AQUI'
LIMIT 1;
```

### Ver productos con mejor ROI
```sql
SELECT 
  sku,
  nombre,
  precio_b2b,
  precio_sugerido,
  profit_amount as ganancia,
  roi_percent as roi,
  CASE pvp_source
    WHEN 'market' THEN '💰 Mercado'
    WHEN 'admin' THEN '👤 Admin'
    ELSE '🔢 Calculado'
  END as origen_precio
FROM v_productos_con_precio_b2b
WHERE profit_amount > 0
ORDER BY roi_percent DESC
LIMIT 20;
```

### Ver configuración de márgenes
```sql
SELECT 
  category_id,
  default_margin_percent,
  suggested_pvp,
  is_active
FROM pricing_configs
WHERE is_active = true;
```

=====================================================
## 🛠️ DÓNDE MODIFICAR LOS CÁLCULOS
=====================================================

### Frontend (ProductCardB2B.tsx)
**Líneas 36-52:**
```typescript
// Cambiar cómo se calcula profit o roi
const profit = product.profit_amount ?? 
  ((product.precio_sugerido || 0) - product.precio_b2b);

const roiPercent = product.roi_percent ?? 
  (product.precio_b2b > 0 ? (profit / product.precio_b2b) * 100 : 0);
```

### Backend (Vista SQL)
**Archivo:** supabase/migrations/XXXX_vista_productos_b2b.sql
```sql
-- Dentro de v_productos_con_precio_b2b
profit_amount AS (precio_sugerido - precio_b2b),
roi_percent AS (
  CASE 
    WHEN precio_b2b > 0 THEN
      ((precio_sugerido - precio_b2b) / precio_b2b) * 100
    ELSE 0
  END
)
```

### Configuración Admin
**Ruta:** `/admin/precios-config`
- Ajustar márgenes por categoría
- Configurar PVP sugerido manual
- Activar/desactivar sincronización con mercado

=====================================================
## ⚙️ OPCIONES DE PERSONALIZACIÓN
=====================================================

### Para cambiar el margen por defecto:
1. Ir a Admin → Precios Config
2. Seleccionar categoría
3. Cambiar `default_margin_percent`
4. Los productos se recalcularán automáticamente

### Para usar precios del mercado:
1. Asegurar que `b2c_market_prices` tenga datos
2. La vista automáticamente usará `max_price` si existe
3. `is_market_synced` será `true`

### Para ocultar el banner verde:
**En ProductCardB2B.tsx, línea 230:**
```typescript
// Comentar o eliminar:
{profit > 0 && (
  <div className="flex items-center justify-between...">
    // ... contenido del banner
  </div>
)}
```

### Para cambiar el color del banner:
```typescript
// Cambiar:
bg-green-50    → bg-blue-50
text-green-700 → text-blue-700
text-green-600 → text-blue-600
```

=====================================================
## 🎯 RESUMEN FINAL
=====================================================

**Ganancia y ROI se calculan en:**
1. ✅ Backend: Vista SQL `v_productos_con_precio_b2b`
2. ✅ Frontend: `ProductCardB2B.tsx` (como fallback)

**Datos vienen de:**
1. 🥇 Mercado B2C (`b2c_market_prices.max_price`)
2. 🥈 Admin (`pricing_configs.suggested_pvp`)
3. 🥉 Cálculo automático (precio_b2b × margen)

**Para el ejemplo del usuario:**
- Precio B2B: $23.88
- PVP Sugerido: $95.52
- Ganancia: $71.64
- ROI: 300%

**Archivos clave:**
- Vista SQL: `v_productos_con_precio_b2b`
- Componente: `ProductCardB2B.tsx`
- Configuración: `/admin/precios-config`
