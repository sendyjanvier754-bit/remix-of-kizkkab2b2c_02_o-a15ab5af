# IMPLEMENTACIÓN DE PRECIOS DINÁMICOS CENTRALIZADOS

## 📋 Resumen Ejecutivo

Se ha creado una **Vista SQL centralizada** (`v_productos_con_precio_b2b`) que calcula precios B2B dinámicamente basándose en:
- Costo de Fábrica
- Costo Tramo A (China → Hub Tránsito)
- Costo Tramo B (Hub → País Destino)  
- Fees de Plataforma (12%)

**Ventaja Principal**: El frontend NO necesita cambiar sus variables. Simplemente consulta la vista en lugar de la tabla.

---

## 🔧 PASO 1: Aplicar la Migración SQL

### Opción A: Desde Supabase Dashboard
1. Ir a: https://app.supabase.com/project/fonvunyiaxcjkodrnpox/sql/new
2. Copiar el contenido de: `supabase/migrations/20260131_create_dynamic_pricing_view.sql`
3. Ejecutar el script completo
4. Verificar que no haya errores

### Opción B: Desde CLI (cuando esté reparado)
```bash
cd c:\Users\STAVE RICHARD DORVIL\kizkkab2b2c
supabase db push  # Después de reparar el historial de migraciones
```

---

## 🎯 PASO 2: Actualizar los Servicios Frontend

### Servicios a Modificar:

#### 1. `src/services/productService.ts` (o similar)
```typescript
// ANTES
export async function getProducts() {
  return supabase
    .from('products')  // ❌ Tabla estática
    .select('*');
}

// DESPUÉS  
export async function getProducts() {
  return supabase
    .from('v_productos_con_precio_b2b')  // ✅ Vista dinámica
    .select('*');
}
```

#### 2. `src/services/catalogService.ts`
```typescript
// ANTES
const { data: products } = await supabase
  .from('products')
  .select('*')
  .eq('categoria_id', categoryId);

// DESPUÉS
const { data: products } = await supabase
  .from('v_productos_con_precio_b2b')
  .select('*')
  .eq('categoria_id', categoryId);
```

#### 3. `src/services/cartService.ts`
```typescript
// ANTES - Calculaba precio aquí
const cartPrice = product.costo_base_excel + logistics;

// DESPUÉS - Usa valor precalculado
const cartPrice = product.precio_b2b; // ✅ Ya viene calculado
```

#### 4. Para consultas con Mercado (si aplica)
```typescript
// Nueva función para precios por mercado
export async function getProductsByMarket(marketId: string) {
  return supabase
    .from('v_productos_mercado_precio')  // ✅ Vista con mercado
    .select('*')
    .eq('market_id', marketId);
}
```

---

## 📁 Hooks a Actualizar

### `src/hooks/useProducts.ts` (o similar)
```typescript
// ANTES
const fetchProducts = async () => {
  const { data } = await supabase
    .from('products')  // ❌
    .select('*');
  return data;
};

// DESPUÉS
const fetchProducts = async () => {
  const { data } = await supabase
    .from('v_productos_con_precio_b2b')  // ✅
    .select('*');
  return data;
};
```

### `src/hooks/useCart.ts`
```typescript
// ANTES
const addToCart = (product) => {
  // Calculaba precio manualmente
  const finalPrice = calculatePrice(product, market);
  cart.push({...product, precio_b2b: finalPrice});
};

// DESPUÉS
const addToCart = (product) => {
  // Solo usa precio que ya viene en product
  cart.push(product); // ✅ product.precio_b2b ya es dinámico
};
```

---

## 🧩 Componentes: NO REQUIEREN CAMBIOS

Los componentes siguen leyendo las mismas variables:

```typescript
// ProductCard.tsx - ¡SIN CAMBIOS!
<div className="price">
  ${product.precio_b2b}  // ✅ Sigue siendo lo mismo, pero dinámico
</div>

// CartItem.tsx - ¡SIN CAMBIOS!
<span className="unit-price">
  {item.precio_b2b}  // ✅ Sigue siendo lo mismo, pero dinámico
</span>

// InvestorDashboard.tsx - ¡SIN CAMBIOS!
<td className="b2b-price">
  {product.precio_b2b}  // ✅ Sigue siendo lo mismo, pero dinámico
</td>
```

---

## 🔄 FLUJO DE CAMBIO AUTOMÁTICO

### Escenario: Admin cambia costo de flete

1. **ANTES** (Manual):
   - Admin cambia costo en tabla `route_logistics_costs`
   - Frontend sigue mostrando precio viejo (✗ Error de cálculo)
   - Hay que ir archivo por archivo actualizando la lógica

2. **DESPUÉS** (Automático):
   - Admin cambia costo en tabla `route_logistics_costs`
   - Vista `v_productos_con_precio_b2b` recalcula automáticamente
   - Todos los componentes que usan `producto.precio_b2b` se actualizan instantáneamente (✓)
   - No hay que tocar ningún archivo .tsx

---

## 📊 Vistas Disponibles

### 1. `v_productos_con_precio_b2b` - USO PRINCIPAL
- Contiene TODOS los campos de productos
- `precio_b2b` es dinámico y calculado
- Ideal para catálogo, carrito, búsqueda
- Múltiples mercados: se usa mercado default

```sql
SELECT * FROM v_productos_con_precio_b2b WHERE categoria_id = '...'
```

### 2. `v_productos_mercado_precio` - CON INFORMACIÓN DE MERCADO
- Incluye campos de mercado (market_id, market_name, currency)
- `precio_b2b` calculado específicamente para ese mercado
- Ideal para consultas multi-mercado

```sql
SELECT * FROM v_productos_mercado_precio WHERE market_id = '...'
```

### 3. `v_pricing_breakdown` - SOLO PARA ADMIN
- Desglose completo: costo_fabrica, tramo_a, tramo_b, fee_plataforma
- Útil para Panel de Admin ver cómo se calcula
- NO usar en cliente (expone costos internos)

```sql
SELECT * FROM v_pricing_breakdown WHERE product_id = '...'
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] **Migración SQL aplicada** en Supabase
  - [ ] Función `calculate_b2b_price()` creada
  - [ ] Vistas creadas (`v_productos_con_precio_b2b`, etc.)
  - [ ] Índices creados para performance

- [ ] **Servicios actualizados**
  - [ ] `productService.ts` consulta vistas
  - [ ] `catalogService.ts` consulta vistas
  - [ ] `cartService.ts` usa `precio_b2b` dinámico
  - [ ] Funciones de búsqueda usan vistas

- [ ] **Hooks actualizados**
  - [ ] `useProducts()` consulta vista
  - [ ] `useCart()` no calcula, solo usa valor
  - [ ] `useCatalog()` consulta vista
  - [ ] `useMarket()` usa `v_productos_mercado_precio` si aplica

- [ ] **Componentes: Verificar (NO cambiar)**
  - [ ] ProductCard sigue leyendo `product.precio_b2b`
  - [ ] CartItem sigue leyendo `item.precio_b2b`
  - [ ] InvestorDashboard sigue leyendo `product.precio_b2b`
  - [ ] AdminPanel sigue leyendo `product.precio_b2b`

- [ ] **Testing**
  - [ ] [ ] Verificar que `precio_b2b` se calcula correctamente
  - [ ] [ ] Cambiar costo de flete y verificar que precio se actualiza
  - [ ] [ ] Probar en diferentes mercados
  - [ ] [ ] Verificar performance (consultas no son lentas)

---

## 🚀 ROLLBACK (si es necesario)

Si algo falla y necesitas volver a la tabla estática:

```sql
-- En Supabase SQL editor
ALTER TABLE public.products
RENAME COLUMN precio_mayorista_base TO precio_mayorista;

-- Comentar las vistas en el código frontend
// FROM: 'v_productos_con_precio_b2b'
// TO:   'products'
```

---

## 📞 SOPORTE

Si hay errores:

1. **"Vista no existe"**: Ejecutar migración SQL nuevamente
2. **"Precio no se actualiza"**: Verificar que tabla consultada sea vista, no tabla
3. **"Queries lentas"**: Los índices deberían ayudar; si sigue lento, revisar logs

---

## 🔐 SEGURIDAD

- ✅ Las vistas respetan RLS policies existentes
- ✅ Los usuarios solo ven datos que ya pueden ver
- ✅ No hay exposición de datos sensibles (excepto `v_pricing_breakdown` para admin)
- ✅ Los precios son calculados en la BD, no en el cliente

---

## 📝 RESUMEN TÉCNICO

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Cálculo** | Frontend (disperso) | BD (centralizado) |
| **Fuente** | Tabla `products` | Vista `v_productos_con_precio_b2b` |
| **Actualización** | Manual en múltiples archivos | Automática cuando cambia logística |
| **Variable** | `product.precio_mayorista` | `product.precio_b2b` (mismo nombre, valor dinámico) |
| **Riesgo** | Alto: olvidar actualizar archivo | Bajo: cambio automático |
| **Performance** | N/A | Óptima con índices |

