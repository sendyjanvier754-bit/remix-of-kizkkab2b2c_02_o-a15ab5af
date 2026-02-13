# 🚀 GUÍA DE IMPLEMENTACIÓN: Opción B - Tarifas Reales

## 📋 Resumen

Vas a migrar del sistema de fórmula simplificada ($11.05 + $5.82) al sistema de tarifas reales configurables desde la base de datos.

**Tiempo estimado:** 30-45 minutos  
**Nivel de riesgo:** Bajo (tiene fallback a fórmula simple)  
**Reversible:** Sí

---

## 📦 Archivos Necesarios

✅ Ya creados y listos:

1. `VERIFICAR_SISTEMA_TARIFAS_REALES.sql` - Verifica requisitos
2. `CONFIGURAR_TARIFAS_REALES.sql` - Configura datos iniciales
3. `TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql` - Calcula peso automático
4. `TRIGGER_AUTO_CALCULAR_COSTO_TARIFA_REAL.sql` - Usa tarifas reales
5. `ACTUALIZAR_PESO_ITEMS_AHORA.sql` - Actualiza items existentes

---

## 🎯 PASO A PASO

### PASO 1: Verificar Sistema Actual ⏱️ 2 minutos

Abre PowerShell y ejecuta:

```powershell
# Navegar a la carpeta del proyecto
cd "c:\Users\STAVE RICHARD DORVIL\kizkkab2b2c"

# Conectarte a tu base de datos y ejecutar verificación
# Reemplaza con tu comando de conexión real
psql -U postgres -d tu_base_de_datos -f VERIFICAR_SISTEMA_TARIFAS_REALES.sql
```

**Qué esperar:**

El script mostrará el estado de:
- ✅ Función `calculate_shipping_cost_cart` (debe existir)
- ✅ Tablas configuradas (shipping_tiers, routes, etc.)
- 📊 Comparación de costos (fórmula simple vs real)

**Posibles resultados:**

#### Resultado A: Todo ✅ (Sistema completo)
```
✅ Función existe
✅ 3 tiers configurados
✅ 1 rutas
✅ 4 hubs
✅ SISTEMA LISTO! Puedes instalar los triggers
```
→ **Salta al PASO 3**

#### Resultado B: Función ❌ pero tablas ✅
```
❌ Función NO existe - NECESITAS CREARLA
✅ 3 tiers configurados
✅ 1 rutas
```
→ **Ve al PASO 2A**

#### Resultado C: Todo ⚠️ (Tablas vacías)
```
❌ Función NO existe
⚠️  Tabla vacía - necesitas agregar tiers
⚠️  Tabla vacía - necesitas agregar rutas
```
→ **Ve al PASO 2B**

---

### PASO 2A: Crear Función (si falta) ⏱️ 5 minutos

Si la función `calculate_shipping_cost_cart` NO existe, búscala en tus migraciones:

```powershell
# Buscar el archivo que crea la función
Get-ChildItem -Path . -Filter "*shipping_cost*.sql" -Recurse | Select-Object Name, FullName
```

Buscar archivos como:
- `MIGRACION_ACTUALIZAR_SHIPPING_FUNCTIONS*.sql`
- `20260*_create_dynamic_pricing_view.sql`
- `20260*_shipping_functions.sql`

**Ejecutar el que encuentres:**
```powershell
psql -U postgres -d tu_base_de_datos -f supabase/migrations/NOMBRE_DEL_ARCHIVO.sql
```

**Si no encuentras ninguno:** La función existe en tu código pero con otro nombre, o necesitas crearla. Avísame y te la creo.

---

### PASO 2B: Configurar Datos Iniciales (si faltan) ⏱️ 3 minutos

Si las tablas están vacías, ejecuta:

```powershell
psql -U postgres -d tu_base_de_datos -f CONFIGURAR_TARIFAS_REALES.sql
```

**Qué hace este script:**
- Crea Transportation Hubs (China, USA)
- Crea Destination Countries (Haití, RD, USA)
- Crea Shipping Tiers con tarifas equivalentes a fórmula actual
- Crea Shipping Routes (China → Haití)
- Crea Shipping Types (Standard, Express, Economy)

**Importante:** Las tarifas están configuradas para dar resultados similares a la fórmula actual ($11.05 + $5.82).

---

### PASO 3: Verificar de Nuevo ⏱️ 2 minutos

Vuelve a ejecutar la verificación:

```powershell
psql -U postgres -d tu_base_de_datos -f VERIFICAR_SISTEMA_TARIFAS_REALES.sql
```

**Debes ver:**
```
✅ Función existe
✅ 3 tiers configurados
✅ 1 rutas
✅ 4 hubs
✅ SISTEMA LISTO!
```

**También verás una tabla de comparación:**
```
╔════════════════════════════════════════════════════════════════╗
║  Peso (kg)  │  Fórmula Simple  │  Tarifa Real  │  Diferencia ║
╠════════════════════════════════════════════════════════════════╣
║    0.5      │    $11.05        │   $11.20      │   $0.15     ║
║    1.0      │    $11.05        │   $11.05      │   $0.00     ║
║    2.0      │    $16.87        │   $17.10      │   $0.23     ║
...
```

**Si la diferencia es grande (>10%):** Ajusta las tarifas en `shipping_tiers` antes de continuar.

---

### PASO 4: Instalar Trigger de Peso Automático ⏱️ 2 minutos

Primero instala el trigger que calcula el peso automáticamente:

```powershell
psql -U postgres -d tu_base_de_datos -f TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql
```

**Qué hace:**
- Calcula `peso_kg` automáticamente al agregar items al carrito
- Funciona para B2B y B2C
- Usa peso de variante o producto según corresponda

**Verificar:**
```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_calculate_cart_item_weight';
```

Debe mostrar 2 triggers (uno para b2b_cart_items, otro para b2c_cart_items).

---

### PASO 5: Actualizar Items Existentes ⏱️ 2 minutos

Actualiza los items que ya están en carritos:

```powershell
psql -U postgres -d tu_base_de_datos -f ACTUALIZAR_PESO_ITEMS_AHORA.sql
```

**Qué hace:**
- Calcula `peso_kg` para todos los items en carritos abiertos
- Solo se ejecuta UNA VEZ

**Verificar:**
```sql
SELECT 
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE peso_kg > 0) as items_con_peso,
  AVG(peso_kg) as peso_promedio
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.status = 'open';
```

Todos los items deben tener `peso_kg > 0`.

---

### PASO 6: Instalar Trigger de Tarifas Reales ⏱️ 2 minutos

Ahora instala el trigger principal que usa tarifas reales:

```powershell
psql -U postgres -d tu_base_de_datos -f TRIGGER_AUTO_CALCULAR_COSTO_TARIFA_REAL.sql
```

**Qué hace:**
- Usa `calculate_shipping_cost_cart()` con tarifas de la BD
- Considera ruta, tipo de envío, sobrepeso, dimensiones
- Tiene fallback a fórmula simple si hay error
- Actualiza `total_weight_kg` y `shipping_cost_usd` en carritos

**Verificar:**
```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_cart_shipping';
```

Debe mostrar que usa la función `fn_update_cart_shipping_cost_dynamic`.

---

### PASO 7: Probar el Sistema ⏱️ 10 minutos

#### Test 1: Insertar item de prueba

```sql
-- Insertar item SIN especificar peso ni costo
INSERT INTO b2b_cart_items (
  cart_id,
  product_id,
  sku,
  nombre,
  quantity,
  unit_price,
  total_price
)
VALUES (
  (SELECT id FROM b2b_carts WHERE status = 'open' LIMIT 1),
  (SELECT id FROM products WHERE is_active = TRUE LIMIT 1),
  'TEST-TARIFA-REAL-' || FLOOR(RANDOM() * 10000),
  'Producto Test Tarifa Real',
  2,
  15.00,
  30.00
);

-- Verificar que peso se calculó automáticamente
SELECT 
  sku,
  peso_kg as "Peso Calculado (debe ser > 0)",
  quantity,
  peso_kg * quantity as "Peso Total"
FROM b2b_cart_items
WHERE sku LIKE 'TEST-TARIFA-REAL-%';
```

**Esperado:** `peso_kg > 0`

#### Test 2: Verificar que carrito se actualizó

```sql
-- Ver costo actualizado en el carrito
SELECT 
  bc.id,
  bc.total_weight_kg as "Peso Total (kg)",
  bc.shipping_cost_usd as "Costo Envío (USD)",
  bc.last_shipping_update as "Actualizado"
FROM b2b_carts bc
WHERE bc.status = 'open'
  AND EXISTS (
    SELECT 1 FROM b2b_cart_items 
    WHERE cart_id = bc.id 
    AND sku LIKE 'TEST-TARIFA-REAL-%'
  );
```

**Esperado:** 
- `total_weight_kg > 0`
- `shipping_cost_usd > 0`
- `last_shipping_update` reciente (último minuto)

#### Test 3: Comparar con fórmula simple

```sql
WITH test_cart AS (
  SELECT 
    bc.id,
    bc.total_weight_kg,
    bc.shipping_cost_usd as costo_tarifa_real
  FROM b2b_carts bc
  WHERE bc.status = 'open'
  LIMIT 1
),
simple_formula AS (
  SELECT 
    total_weight_kg,
    CASE 
      WHEN total_weight_kg = 0 THEN 0
      WHEN CEIL(total_weight_kg) <= 1 THEN 11.05
      ELSE 11.05 + ((CEIL(total_weight_kg) - 1) * 5.82)
    END as costo_formula_simple
  FROM test_cart
)
SELECT 
  tc.total_weight_kg as "Peso (kg)",
  tc.costo_tarifa_real as "Tarifa Real ($)",
  sf.costo_formula_simple as "Fórmula Simple ($)",
  ROUND((tc.costo_tarifa_real - sf.costo_formula_simple), 2) as "Diferencia ($)",
  ROUND((tc.costo_tarifa_real - sf.costo_formula_simple) / sf.costo_formula_simple * 100, 1) as "% Diferencia"
FROM test_cart tc
CROSS JOIN simple_formula sf;
```

**Esperado:** Diferencia < 10%

#### Test 4: Limpiar datos de prueba

```sql
DELETE FROM b2b_cart_items WHERE sku LIKE 'TEST-TARIFA-REAL-%';
```

---

### PASO 8: Probar en Frontend ⏱️ 5 minutos

1. Abre tu aplicación web
2. Ve a la página de productos
3. Agrega un producto al carrito
4. Abre la consola del navegador (F12)
5. Verifica que el item tiene `peso_kg > 0`
6. Ve al carrito y verifica que muestra el costo de envío
7. Debe aparecer inmediatamente (sin refresh)

**Si el costo no aparece:**
- Verifica que el frontend lee de `b2b_carts.shipping_cost_usd`
- O que llama a la vista `v_cart_shipping_costs`
- Puede que necesites actualizar el hook del frontend (avísame)

---

## 🎉 ¡LISTO!

Si todos los tests pasaron, el sistema está funcionando con tarifas reales.

### 📊 Qué Cambió

**ANTES:**
- Peso se insertaba como NULL
- Había que ejecutar script manual
- Costo usaba fórmula hardcoded

**AHORA:**
- Peso se calcula automáticamente
- Costo se actualiza en tiempo real
- Usa tarifas configurables de la BD

### ⚙️ Ajustar Tarifas

Para cambiar las tarifas, edita la tabla `shipping_tiers`:

```sql
-- Ver tarifas actuales
SELECT name, tramo_a_cost_per_kg, tramo_b_cost_per_lb 
FROM shipping_tiers;

-- Actualizar tarifa STANDARD
UPDATE shipping_tiers
SET 
  tramo_a_cost_per_kg = 4.00,  -- Nuevo precio tramo A
  tramo_b_cost_per_lb = 5.50   -- Nuevo precio tramo B
WHERE name = 'STANDARD';
```

Los nuevos carritos usarán las tarifas actualizadas automáticamente.

---

## 🐛 Troubleshooting

### Problema: "Función calculate_shipping_cost_cart no existe"

**Solución:**
```powershell
# Buscar en migraciones
Get-ChildItem -Path .\supabase\migrations -Filter "*.sql" | 
  Select-String -Pattern "calculate_shipping_cost_cart" -List
  
# Ejecutar el archivo que la crea
```

### Problema: Costos muy diferentes a la fórmula simple

**Causa:** Las tarifas en `shipping_tiers` no están calibradas.

**Solución:**
```sql
-- Ajustar tarifas STANDARD para que coincidan
UPDATE shipping_tiers
SET 
  tramo_a_cost_per_kg = 3.50,
  tramo_b_cost_per_lb = 5.00
WHERE name = 'STANDARD';
```

### Problema: Trigger no se ejecuta

**Verificar:**
```sql
-- Ver si el trigger existe
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_update_cart_shipping';

-- Ver si la función existe
SELECT * FROM pg_proc 
WHERE proname = 'fn_update_cart_shipping_cost_dynamic';
```

### Problema: Peso sigue siendo NULL

**Verificar:**
```sql
-- ¿El trigger de peso está instalado?
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_calculate_cart_item_weight';

-- ¿Los productos tienen peso?
SELECT id, nombre, peso_kg, peso_g 
FROM products 
WHERE is_active = TRUE 
LIMIT 10;
```

---

## 📞 Soporte

Si algo falla:

1. Ejecuta `VERIFICAR_SISTEMA_TARIFAS_REALES.sql` de nuevo
2. Revisa los errores en los logs de Postgres
3. Avísame qué error ves y te ayudo

---

## 🔄 Rollback (Si necesitas volver atrás)

Si algo sale mal, puedes volver a la fórmula simple:

```sql
-- Eliminar triggers de tarifas reales
DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2b_cart_items;
DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2c_cart_items;
DROP FUNCTION IF EXISTS fn_update_cart_shipping_cost_dynamic();

-- Reinstalar trigger con fórmula simple
-- (ejecutar TRIGGER_AUTO_CALCULAR_COSTO_ENVIO_CARRITO.sql)
```

El trigger de peso (`trigger_calculate_cart_item_weight`) puede quedarse, no hace daño.

---

¿Listo para empezar? ¡Ejecuta el PASO 1! 🚀
