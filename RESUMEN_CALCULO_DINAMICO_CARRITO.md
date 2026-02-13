# 📦 Cálculo Dinámico de Logística en Carrito - Resumen Ejecutivo

**Fecha:** 2026-02-12  
**Status:** ✅ Implementación Completa | ⏸️ Pendiente Ejecución en Supabase

---

## 🎯 Problema Identificado

El sistema anterior usaba una **vista estática** (`v_cart_shipping_costs`) que simulaba un carrito con **10 productos fijos** para todos los usuarios. Esto generaba:

- ❌ Costos de logística **inexactos** 
- ❌ Mismo cálculo para **todos los usuarios**
- ❌ No reflejaba el **carrito real** del cliente
- ❌ No se actualizaba al cambiar cantidades/productos

---

## ✅ Solución Implementada

Creamos un **sistema de cálculo dinámico** con **2 opciones complementarias**:

### **Opción A: Frontend Pasa Items (FLEXIBLE) ✅**

**Componentes:**

1. **`calculate_cart_shipping_cost_dynamic(cart_items JSONB)`**
   - Función PostgreSQL que recibe items del carrito como parámetro
   - Calcula peso total: `Σ(peso × cantidad)`
   - Llama a `calculate_shipping_cost_cart()` con peso real

2. **`get_cart_shipping_cost(cart_items JSONB)`**
   - RPC wrapper para el frontend
   - Frontend pasa items explícitamente: `[{product_id, variant_id, quantity}]`
   - Ideal cuando ya tienes items en memoria/estado

**Cuándo usar:**
- ✅ Ya tienes items cargados en estado del carrito
- ✅ Necesitas calcular costo de items específicos (no guardados todavía)
- ✅ Testing con datos mock
- ✅ Máxima flexibilidad

### **Opción B: DB Consulta Carrito (CONVENIENTE) ✨**

**Componentes:**

1. **`get_user_cart_shipping_cost(user_id UUID)`** (NUEVA)
   - Consulta `b2b_cart_items` directamente desde la DB
   - Solo necesitas `user_id`
   - Construye array interno y llama a función dinámica

2. **`get_cart_id_shipping_cost(cart_id UUID)`** (NUEVA)
   - Similar pero acepta `cart_id` en lugar de `user_id`
   - Útil para carritos específicos

**Cuándo usar:**
- ✅ Solo tienes `user_id` (no items en memoria)
- ✅ Backend jobs que calculan costos periódicamente
- ✅ APIs que retornan costo sin construir array
- ✅ Dashboard admin mostrando costos de usuarios
- ✅ Frontend más simple - un solo parámetro

---

## 📊 Flujo de Datos (Nuevo)

```
Usuario agrega productos al carrito
         ↓
items = [
  {productId: 'uuid1', variantId: null, cantidad: 2},
  {productId: 'uuid2', variantId: 'uuid3', cantidad: 5}
]
         ↓
Hook: useB2BCartLogistics(items)
         ↓
supabase.rpc('get_cart_shipping_cost', {
  cart_items: [{product_id, variant_id, quantity}]
})
         ↓
calculate_cart_shipping_cost_dynamic()
  1. Itera cada item
  2. Obtiene peso de products/variants
  3. Acumula: peso_total += peso × cantidad
  4. Llama: calculate_shipping_cost_cart(peso_total)
  5. Aplica CEIL(peso_total)
  6. Calcula Tramo A + Tramo B + surcharges
         ↓
Retorna: {
  total_items: 7,
  total_weight_kg: 8.5,
  weight_rounded_kg: 9,
  total_cost_with_type: 69.30
}
         ↓
UI muestra: "Logística Total: +$69.30"
```

---

## 💡 Ejemplo Real

### **Carrito Usuario A:**
```
Producto: iPhone 13 (0.5 kg) × 2 = 1.0 kg
Producto: MacBook (2.0 kg) × 1 = 2.0 kg
Producto: Mouse (0.3 kg) × 3 = 0.9 kg
───────────────────────────────────────
Total: 3.9 kg → CEIL = 4 kg

Cálculo:
  Tramo A: 4 kg × 3.50 USD/kg = 14.00 USD
  Tramo B: 4 kg × 2.20462 × 5.00 USD/lb = 44.09 USD
  Total: 58.09 USD ✅
```

### **Carrito Usuario B:**
```
Producto: Bolso (0.8 kg) × 1 = 0.8 kg
Producto: Zapatos (1.2 kg) × 2 = 2.4 kg
───────────────────────────────────────
Total: 3.2 kg → CEIL = 4 kg
Total: 58.09 USD ✅
```

**Resultado:** Cada usuario ve el costo **exacto** de su carrito específico.

---

## 📁 Archivos Modificados/Creados

### **Backend (SQL) - Opción A: Frontend Pasa Items:**
- ✅ `FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql` (302 líneas)
  - Contiene: `calculate_cart_shipping_cost_dynamic()` y `get_cart_shipping_cost()`
  - Recibe items como parámetro JSONB
  - Incluye query de prueba con productos reales
  - Maneja productos + variantes
  - Soporta múltiples columnas de peso: weight_kg, peso_kg, weight_g, peso_g

### **Backend (SQL) - Opción B: DB Consulta Carrito:**
- ✅ `FUNCION_CALCULAR_COSTO_CARRITO_USUARIO.sql` (NUEVO - 278 líneas)
  - Contiene: `get_user_cart_shipping_cost(user_id)` y `get_cart_id_shipping_cost(cart_id)`
  - Consulta `b2b_cart_items` directamente desde DB
  - Construye array de items internamente
  - Llama a funciones de Opción A para cálculo
  - Incluye ejemplos de uso y casos recomendados

### **Frontend (TypeScript):**
- ✅ `src/hooks/useB2BCartLogistics.ts` (MODIFIED)
  - Usa **Opción A** actualmente
  - Cambió de: `supabase.from('v_cart_shipping_costs')`
  - A: `supabase.rpc('get_cart_shipping_cost', { cart_items })`
  - Agregado: `useMemo()` para construir `cartItemsForShipping`
  - Query key incluye items para re-fetch automático

### **Documentación:**
- ✅ `INTEGRACION_V_CART_SHIPPING_COSTS_CARRITO.sql` (UPDATED)
  - Actualizado con nuevo flujo v3.0
  - Diagramas de flujo actualizados
  - Ejemplos de testing agregados
  - Changelog incluido
  
- ✅ `RESUMEN_CALCULO_DINAMICO_CARRITO.md` (THIS FILE - UPDATED)
  - Describe ambas opciones (A y B)
  - Casos de uso para cada una
  - Comparación y recomendaciones

---

## ⏸️ Pasos Pendientes de Ejecución

### **1. Ejecutar SQL en Supabase:**
```sql
-- Abrir: Supabase SQL Editor
-- Copiar contenido de: FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql
-- Ejecutar script completo

-- Verificar que funciones existen:
SELECT proname FROM pg_proc WHERE proname LIKE '%cart_shipping%';

-- Debe retornar:
--   calculate_cart_shipping_cost_dynamic
--   get_cart_shipping_cost
```

### **2. Test Manual con Datos Reales:**
```sql
-- Obtener productos activos
SELECT id, name, weight_kg FROM products WHERE active = true LIMIT 3;

-- Probar función con IDs reales
SELECT * FROM calculate_cart_shipping_cost_dynamic('[
  {"product_id": "id-real-1", "quantity": 2},
  {"product_id": "id-real-2", "quantity": 3}
]'::jsonb);

-- Verificar resultado tiene:
-- total_items = 5 (2+3)
-- total_weight_kg > 0
-- total_cost_with_type en USD
```

### **3. Test Frontend:**
```bash
# Terminal
npm run dev

# En el navegador:
# 1. Abrir carrito B2B
# 2. Agregar varios productos
# 3. Cambiar cantidades
# 4. Verificar que "Logística Total" se actualiza

# Console (F12):
# Ver llamadas RPC
# Verificar estructura de respuesta
```

### **4. Git Commit:**
```bash
git add .
git commit -m "feat: implement dynamic cart shipping calculation based on real user cart items

- Created calculate_cart_shipping_cost_dynamic() SQL function
- Added get_cart_shipping_cost() RPC wrapper  
- Updated useB2BCartLogistics hook to use dynamic calculation
- Updated cart shipping integration documentation
- System now calculates shipping cost from actual cart products/quantities"

git push origin main
```

---

## 🚀 Beneficios del Nuevo Sistema

### Comparación: Vista Estática vs Funciones Dinámicas

| Aspecto | Antes (v2.0) | Opción A (v3.0) | Opción B (v3.0) |
|---------|--------------|-----------------|-----------------|
| **Método** | ❌ Vista estática | ✅ Frontend pasa items | ✅ DB consulta items |
| **Función** | `v_cart_shipping_costs` | `get_cart_shipping_cost()` | `get_user_cart_shipping_cost()` |
| **Parámetros** | Ninguno (fijo) | `cart_items JSONB` | `user_id UUID` |
| **Datos** | 10 productos fijos | Items del parámetro | Query a `b2b_cart_items` |
| **Precisión** | ❌ Aproximado | ✅ Exacto | ✅ Exacto |
| **Actualización** | ❌ Estático | ✅ Real-time | ✅ Real-time |
| **Flexibilidad** | ❌ Ninguna | ✅✅ Máxima | ✅ Alta |
| **Frontend** | Simple query | Construir array | Un solo parámetro |
| **Testing** | ⚠️ Difícil | ✅ Fácil (mock data) | ✅ Fácil (test users) |
| **Uso** | Sin carrito guardado | Con items en memoria | Con carrito en DB |
| **Backend Jobs** | ❌ No aplica | ⚠️ Necesita items | ✅ Ideal |

### Tabla de Decisión: ¿Qué Opción Usar?

| Escenario | Opción A | Opción B | Razón |
|-----------|----------|----------|-------|
| Componente carrito activo | ✅ SÍ | No | Items ya en estado |
| Backend job periódico | No | ✅ SÍ | Solo tienes user_id |
| API endpoint `/cart-cost` | No | ✅ SÍ | Más simple |
| Calcular costo temporal | ✅ SÍ | No | Items no guardados |
| Dashboard admin | Ambas | ✅ SÍ | user_id disponible |
| Testing unitario | ✅ SÍ | No | Mock data fácil |
| Email carrito abandonado | No | ✅ SÍ | Query desde DB |

---

## 🔍 Query de Verificación Rápida

```sql
-- Test con 2 productos de ejemplo
SELECT 
  total_items as "Items",
  ROUND(total_weight_kg::numeric, 2) as "Peso (kg)",
  weight_rounded_kg as "Peso Redondeado (kg)",
  base_cost as "Costo Base (USD)",
  total_cost_with_type as "💰 TOTAL (USD)",
  shipping_type_display as "Tipo Envío"
FROM calculate_cart_shipping_cost_dynamic('[
  {"product_id": "uuid-producto-1", "quantity": 2},
  {"product_id": "uuid-producto-2", "quantity": 5}
]'::jsonb);
```

---

## 📝 Notas Importantes

1. **Vista `v_cart_shipping_costs` AÚN existe** pero ya NO se usa en producción
   - Se mantiene para referencia y testing
   - Puede eliminarse eventualmente si no se necesita

2. **Función maneja múltiples escenarios:**
   - Productos sin variantes
   - Productos con variantes (prioriza peso de variante)
   - Múltiples columnas de peso: `weight_kg`, `peso_kg`, `weight_g/1000`, `peso_g/1000`
   - Items oversize (surcharge +15%)
   - Volumen dimensional (surcharge +10% si > 0.15 m³)

3. **React Query gestiona caching automáticamente:**
   - Query key incluye items del carrito
   - Se re-fetcha cuando cambia el carrito
   - UI se actualiza sin intervención manual

4. **Moneda:** Todos los costos en **USD** (no HTG)
   - Tramo A: 3.50 USD/kg (China → Tránsito)
   - Tramo B: 5.00 USD/lb (Tránsito → Haití)
   - 1 kg = 2.20462 lb

---

## 🎓 Lecciones Aprendidas

1. **Vistas estáticas NO funcionan para datos específicos del usuario**
   - Necesitamos funciones que acepten parámetros
   - JSONB arrays son ideales para pasar datos complejos

2. **React Query detecta cambios en dependencias**
   - `queryKey` debe incluir datos que cambian
   - `useMemo()` esencial para evitar re-renders innecesarios

3. **PostgreSQL funciones > Queries complejas en frontend**
   - Lógica de negocio centralizada
   - Más fácil de mantener y actualizar
   - Mejor performance

4. **RPC wrappers simplifican integración frontend**
   - Frontend solo pasa datos y recibe resultado
   - No necesita conocer lógica interna
   - Retornar JSONB da flexibilidad

---

## 👤 Autor

STAVE RICHARD DORVIL  
Fecha: 2026-02-12  
Proyecto: KIZKKAB B2B/B2C Platform

---

## 📚 Referencias

- Archivo SQL: `FUNCION_CALCULAR_COSTO_CARRITO_DINAMICO.sql`
- Hook Frontend: `src/hooks/useB2BCartLogistics.ts`
- Documentación Completa: `INTEGRACION_V_CART_SHIPPING_COSTS_CARRITO.sql`
- Función Base: `calculate_shipping_cost_cart()` (CHECK_LOGISTICS_STRUCTURE.sql)
