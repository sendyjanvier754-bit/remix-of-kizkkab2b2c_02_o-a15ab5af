# 🗄️ SQL PARA ACTUALIZAR BD - MOTORES SEPARADOS

**Archivo:** `supabase/migrations/UPDATE_MOTORES_SEPARADOS.sql`  
**Fecha:** 31-01-2026  
**Propósito:** Actualizar BD para separar precio de logística + agregar ETA

---

## 📋 ¿Qué Hace Este SQL?

### 1. Crea Función: `calculate_route_cost()` con ETA
```sql
-- INPUT: route_id, weight_kg
-- OUTPUT: JSON con costo + ETA (fechas reales)

SELECT calculate_route_cost('route-id', 5.0);
-- Retorna: {total_cost, tramo_a, tramo_b, days, eta_date_min, eta_date_max}
```

### 2. Actualiza Vista: `v_productos_con_precio_b2b`
```sql
-- ANTES: Incluía logística (confuso)
-- AHORA: Solo precio_b2b (limpio)

SELECT * FROM v_productos_con_precio_b2b LIMIT 1;
-- Retorna: id, sku, nombre, precio_b2b, weight_kg, ...
-- (SIN logística)
```

### 3. Crea Función: `calculate_base_price_only()`
```sql
-- Calcula SOLO precio base sin logística
-- (Si no existe)

SELECT calculate_base_price_only('prod-id', 30);
-- Retorna: precio_base
```

### 4. Crea Vista: `v_rutas_logistica`
```sql
-- Rutas disponibles con segmentos

SELECT * FROM v_rutas_logistica LIMIT 1;
-- Retorna: route_id, destination, segment_a, segment_b, ...
```

---

## 🚀 Cómo Aplicar el SQL

### Opción A: Supabase Dashboard (RECOMENDADO)

```bash
1. Ir a: https://app.supabase.com/project/fonvunyiaxcjkodrnpox/sql/new

2. Copiar TODO el contenido de:
   supabase/migrations/UPDATE_MOTORES_SEPARADOS.sql

3. Pegar en la ventana SQL Editor

4. Clic en "RUN" (botón azul)

5. ✅ Esperar "Query succeeded" sin errores
```

### Opción B: Supabase CLI (cuando esté reparado)

```bash
cd c:\Users\STAVE RICHARD DORVIL\kizkkab2b2c

# Copiar el archivo a la carpeta de migraciones
cp supabase/migrations/UPDATE_MOTORES_SEPARADOS.sql supabase/migrations/

# Aplicar migraciones
supabase db push
```

---

## ✅ Verificar que Funcionó

### Test 1: Verificar vista v_productos_con_precio_b2b

```sql
SELECT 
  id, 
  sku_interno, 
  nombre,
  precio_b2b, 
  weight_kg,
  margin_value,
  platform_fee
FROM public.v_productos_con_precio_b2b 
LIMIT 1;
```

**Esperado:**
```
id | sku | nombre | precio_b2b | weight_kg | margin | fee
---|-------|--------|----------|-----------|--------|-----
uuid | SKU-123 | Producto | 145.60 | 5.0 | 30.00 | 15.60
```

✅ Debe retornar SOLO precio, sin logística

---

### Test 2: Verificar función calculate_route_cost con ETA

```sql
SELECT calculate_route_cost(
  (SELECT id FROM public.shipping_routes LIMIT 1)::uuid,
  5.0
) AS logistics;
```

**Esperado:**
```json
{
  "total_cost": 150.00,
  "tramo_a_china_to_hub": 100.00,
  "tramo_b_hub_to_destination": 50.00,
  "estimated_days_min": 10,
  "estimated_days_max": 15,
  "eta_date_min": "2026-02-10",
  "eta_date_max": "2026-02-15"
}
```

✅ Debe tener eta_date_min y eta_date_max (nuevos)

---

### Test 3: Verificar vistas existen

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'v_productos_con_precio_b2b', 
    'v_productos_precio_base',
    'v_rutas_logistica'
  );
```

**Esperado:**
```
table_name
─────────────────────────────────
v_productos_con_precio_b2b
v_productos_precio_base
v_rutas_logistica
```

✅ Deben existir las 3 vistas

---

### Test 4: Verificar que ETA calcula fechas reales

```sql
SELECT 
  NOW() AS today,
  (calculate_route_cost(
    (SELECT id FROM public.shipping_routes LIMIT 1)::uuid,
    5.0
  )->'eta_date_min')::text AS eta_min,
  (calculate_route_cost(
    (SELECT id FROM public.shipping_routes LIMIT 1)::uuid,
    5.0
  )->'eta_date_max')::text AS eta_max;
```

**Esperado:**
```
today | eta_min | eta_max
------|---------|--------
2026-01-31 | 2026-02-10 | 2026-02-15
```

✅ Las fechas deben ser TODAY + X días

---

## ⚠️ Posibles Errores y Soluciones

### Error: "View already exists"
```
Solución: El SQL tiene DROP VIEW IF EXISTS
Simplemente ejecuta el SQL de nuevo
```

### Error: "Function already exists"
```
Solución: El SQL usa CREATE OR REPLACE FUNCTION
Simplemente ejecuta el SQL de nuevo
```

### Error: "products table not found"
```
Solución: Verifica que existe la tabla products
SELECT COUNT(*) FROM public.products;
```

### Error: "route_logistics_costs not found"
```
Solución: Verifica que existe la tabla
SELECT COUNT(*) FROM public.route_logistics_costs;
```

---

## 🔄 Proceso Completo

### Paso 1: Aplicar SQL (5 min)
```bash
# En Supabase Dashboard > SQL Editor
→ Copiar y ejecutar UPDATE_MOTORES_SEPARADOS.sql
```

### Paso 2: Verificar (5 min)
```bash
# En Supabase SQL Editor
→ Ejecutar los 4 tests anteriores
→ Todos deben pasar ✅
```

### Paso 3: Actualizar Frontend (10 min)
```bash
# En tu proyecto
→ npm run type-check (debe pasar sin errores)
→ npm run build (debe compilar sin errores)
```

### Paso 4: Testear (10 min)
```bash
# En tu proyecto
→ npm test motors.test.ts
→ 13 tests deben pasar ✅
```

---

## 📊 Cambios Aplicados

| Componente | Antes | Después |
|-----------|-------|---------|
| `v_productos_con_precio_b2b` | Incluía logística | Solo precio ✅ |
| `calculate_route_cost()` | No existía | Existe con ETA ✅ |
| ETA | No tenía | Tiene fechas reales ✅ |
| Claridad | ¿Qué incluye? | Separado ✅ |

---

## 📝 SQL Completo

El archivo está en:
```
supabase/migrations/UPDATE_MOTORES_SEPARADOS.sql
```

**Contiene:**
- Función: `calculate_route_cost()` con ETA
- Función: `calculate_base_price_only()`
- Vista: `v_productos_con_precio_b2b` actualizada
- Vista: `v_productos_precio_base`
- Vista: `v_rutas_logistica`
- Tests para verificar

---

## 🎯 Resumen

**Con este SQL:**
1. ✅ `v_productos_con_precio_b2b` retorna SOLO precio
2. ✅ `calculate_route_cost()` retorna costo + ETA
3. ✅ Frontend obtiene precio y logística por separado
4. ✅ Usuario ve fecha de entrega real

---

## 📞 Próximo Paso

1. **Aplicar este SQL en Supabase**
2. **Ejecutar los 4 tests de verificación**
3. **Compilar frontend** (npm run type-check)
4. **Ejecutar tests frontend** (npm test motors.test.ts)
5. ✅ **Listo para producción**

---

**Tiempo total:** ~30 minutos

**Status:** 🟢 Listo para aplicar
