# 🎯 PLAN DE MEJORA: Actualización Automática de Peso y Costo de Envío

## 📋 PROBLEMA ACTUAL

**Situación:**
- ✅ Los productos tienen peso configurado (`peso_kg`, `peso_g`)
- ✅ El carrito tiene columna `peso_kg` en `b2b_cart_items`
- ✅ La vista `v_cart_shipping_costs` calcula el costo correctamente
- ❌ **PROBLEMA:** Al agregar productos al carrito, el `peso_kg` NO se guarda automáticamente
- ❌ **CONSECUENCIA:** Hay que ejecutar manualmente `ACTUALIZAR_PESO_ITEMS_AHORA.sql` para actualizar

**Experiencia Actual (INCORRECTA):**
```
1. Usuario agrega producto al carrito
2. Frontend inserta en b2b_cart_items con peso_kg = NULL
3. Vista v_cart_shipping_costs ve peso = 0 → costo = $0.00
4. DBA ejecuta ACTUALIZAR_PESO_ITEMS_AHORA.sql manualmente
5. Ahora el costo se muestra correctamente
```

**Experiencia Deseada (como Shein/Temu):**
```
1. Usuario agrega producto al carrito
2. Sistema calcula y guarda peso_kg AUTOMÁTICAMENTE
3. Vista v_cart_shipping_costs calcula costo INMEDIATAMENTE
4. Usuario ve costo de envío actualizado en tiempo real
```

---

## 🎯 SOLUCIÓN SELECCIONADA

### **✅ Opción B Elegida: Sistema de Tarifas Reales Configurables** ⭐

**DECISIÓN:** Se implementará el sistema de tarifas reales usando la infraestructura existente de `shipping_tiers`, `shipping_routes`, `transportation_hubs` y la función `calculate_shipping_cost_cart()`.

**Ventajas de esta elección:**
- ✅ Usa la infraestructura real de tarifas ya configurada en la BD
- ✅ Tarifas configurables sin necesidad de cambiar código
- ✅ Considera rutas complejas (China → USA → destino final)
- ✅ Soporta múltiples tipos de envío (Standard, Express, Economy)
- ✅ Escalable para agregar nuevas rutas/destinos
- ✅ Costos más precisos según logística real
- ✅ Sistema profesional como Shein/Temu

**Por qué NO usamos la fórmula hardcoded ($11.05 + $5.82):**
- ❌ Simplificación que no refleja costos reales
- ❌ Cambios requieren modificar código y redeployar
- ❌ No considera destinos diferentes (Haiti vs RD vs USA)
- ❌ No soporta tipos de envío diferentes
- ❌ Infraestructura sofisticada ya existe pero no se usa

---

## 🏗️ IMPLEMENTACIÓN RECOMENDADA

### **FASE 1: Trigger Automático de Peso (Base de Datos)**

#### `TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql`

```sql
-- =============================================================================
-- TRIGGER: Calcular peso automáticamente al insertar/actualizar items del carrito
-- =============================================================================

-- Función que calcula el peso para un item del carrito
CREATE OR REPLACE FUNCTION fn_calculate_cart_item_weight()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo calcular si peso_kg es NULL o 0
  IF NEW.peso_kg IS NULL OR NEW.peso_kg = 0 THEN
    
    -- Si tiene variant_id: usar peso de variante primero, sino del producto
    IF NEW.variant_id IS NOT NULL THEN
      NEW.peso_kg := (
        SELECT COALESCE(
          NULLIF(pv.peso_kg, 0),        -- Peso de variante en kg
          NULLIF(p.peso_kg, 0),         -- Peso de producto en kg
          pv.peso_g::numeric / 1000.0,  -- Peso de variante en g → kg
          p.peso_g::numeric / 1000.0,   -- Peso de producto en g → kg
          0.3                            -- Default: 300g
        )
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id = NEW.variant_id
      );
    
    -- Si NO tiene variante: usar peso del producto directamente
    ELSIF NEW.product_id IS NOT NULL THEN
      NEW.peso_kg := (
        SELECT COALESCE(
          NULLIF(p.peso_kg, 0),         -- Peso de producto en kg
          p.peso_g::numeric / 1000.0,   -- Peso de producto en g → kg
          0.3                            -- Default: 300g
        )
        FROM products p
        WHERE p.id = NEW.product_id
      );
    
    -- Si no tiene ni variant_id ni product_id: peso default
    ELSE
      NEW.peso_kg := 0.3;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger en b2b_cart_items
DROP TRIGGER IF EXISTS trigger_calculate_cart_item_weight ON b2b_cart_items;

CREATE TRIGGER trigger_calculate_cart_item_weight
  BEFORE INSERT OR UPDATE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_cart_item_weight();

-- Crear el trigger en b2c_cart_items (mismo problema en B2C)
DROP TRIGGER IF EXISTS trigger_calculate_cart_item_weight ON b2c_cart_items;

CREATE TRIGGER trigger_calculate_cart_item_weight
  BEFORE INSERT OR UPDATE ON b2c_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_calculate_cart_item_weight();

COMMENT ON FUNCTION fn_calculate_cart_item_weight() IS 
  'Calcula automáticamente el peso_kg de un item al agregarlo al carrito.
   Usa peso de variante si existe, sino peso del producto.
   Se ejecuta ANTES de INSERT/UPDATE en b2b_cart_items y b2c_cart_items.';
```

---

### **FASE 2: Actualizar Items Existentes (Una Sola Vez)**

Ejecutar el script que ya tienes:

```sql
-- Este script solo se ejecuta UNA VEZ para actualizar los items que ya están en carritos
\i ACTUALIZAR_PESO_ITEMS_AHORA.sql
```

**Después de esto, el trigger se encargará de todos los nuevos items.**

---

### **FASE 3: Optimización Opcional - Guardar Costo Total en Carrito**

Para evitar calcular el costo cada vez, podemos guardar el costo total en `b2b_carts`:

#### `TRIGGER_AUTO_CALCULAR_COSTO_ENVIO_CARRITO.sql`

```sql
-- =============================================================================
-- TRIGGER: Actualizar costo de envío total del carrito automáticamente
-- =============================================================================

-- Agregar columnas al carrito si no existen
ALTER TABLE b2b_carts
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost_usd NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shipping_update TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN b2b_carts.total_weight_kg IS 'Peso total del carrito en kg (suma de items)';
COMMENT ON COLUMN b2b_carts.shipping_cost_usd IS 'Costo de envío calculado en USD';
COMMENT ON COLUMN b2b_carts.last_shipping_update IS 'Última actualización del costo de envío';

-- Función para recalcular el costo de envío del carrito
CREATE OR REPLACE FUNCTION fn_update_cart_shipping_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_cart_id UUID;
  v_total_weight NUMERIC;
  v_shipping_cost NUMERIC;
BEGIN
  -- Obtener el cart_id del item insertado/actualizado/eliminado
  IF TG_OP = 'DELETE' THEN
    v_cart_id := OLD.cart_id;
  ELSE
    v_cart_id := NEW.cart_id;
  END IF;
  
  -- Calcular peso total del carrito
  SELECT 
    COALESCE(SUM(peso_kg * quantity), 0)
  INTO v_total_weight
  FROM b2b_cart_items
  WHERE cart_id = v_cart_id;
  
  -- 🚨 ACTUALIZADO: Usar función de tarifas reales en lugar de fórmula hardcoded
  -- Esto utiliza shipping_tiers, shipping_routes y calculate_shipping_cost_cart()
  -- Si la función falla, fallback a fórmula simple para no romper el sistema
  BEGIN
    v_shipping_cost := calculate_shipping_cost_cart(
      v_cart_id,           -- ID del carrito
      v_total_weight,      -- Peso total
      'STANDARD',          -- Tipo de envío por defecto
      FALSE,               -- No es sobrepeso
      NULL                 -- Sin dimensiones especiales
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback a fórmula simple si la función falla
      IF v_total_weight = 0 THEN
        v_shipping_cost := 0;
      ELSIF CEIL(v_total_weight) <= 1 THEN
        v_shipping_cost := 11.05;
      ELSE
        v_shipping_cost := 11.05 + ((CEIL(v_total_weight) - 1) * 5.82);
      END IF;
  END;
  
  -- Actualizar el carrito
  UPDATE b2b_carts
  SET 
    total_weight_kg = v_total_weight,
    shipping_cost_usd = v_shipping_cost,
    last_shipping_update = NOW()
  WHERE id = v_cart_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para INSERT/UPDATE/DELETE de items
DROP TRIGGER IF EXISTS trigger_update_cart_shipping ON b2b_cart_items;

CREATE TRIGGER trigger_update_cart_shipping
  AFTER INSERT OR UPDATE OR DELETE ON b2b_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cart_shipping_cost();

COMMENT ON FUNCTION fn_update_cart_shipping_cost() IS 
  'Recalcula automáticamente el peso total y costo de envío del carrito
   cuando se agrega, actualiza o elimina un item.';
```

---

### **FASE 4: Actualizar Código TypeScript (Opcional)**

Si quieres que el código TypeScript también pueda ver el peso calculado inmediatamente:

#### Modificar `src/services/cartService.ts`

```typescript
// Línea ~285
const { data: inserted, error: insertError } = await supabase
  .from('b2b_cart_items')
  .insert([
    {
      cart_id: cart.id,
      product_id: productId || null,
      ...basePayload,
      total_price: finalPrice * params.quantity,
      quantity: params.quantity,
      // El trigger calculará peso_kg automáticamente
    },
  ])
  .select('*, peso_kg'); // ✅ AGREGAR: Retornar peso_kg calculado

console.log('B2B: Item inserted with weight:', inserted?.[0]?.peso_kg, 'kg');
```

---

## 📊 RESULTADOS ESPERADOS

### ANTES (Manual)
```
Usuario agrega producto → peso_kg = NULL → costo = $0.00
DBA ejecuta script → peso_kg = 0.3 → costo = $11.05 ✅
```

### DESPUÉS (Automático con Trigger)
```
Usuario agrega producto → 
  → Trigger calcula peso_kg = 0.3 automáticamente
  → Vista lee peso_kg = 0.3
  → Costo = $11.05 ✅ (INSTANTÁNEO)
```

---

## 🧪 PLAN DE TESTING

### 1. Test del Trigger de Peso

```sql
-- Test 1: Insertar item SIN especificar peso
INSERT INTO b2b_cart_items (cart_id, product_id, sku, nombre, quantity, unit_price, total_price)
VALUES (
  (SELECT id FROM b2b_carts WHERE status = 'open' LIMIT 1),
  'e7f8a2c3-1234-5678-90ab-cdef12345678',
  'TEST-SKU',
  'Producto Test',
  1,
  10.00,
  10.00
);

-- Verificar que peso_kg se calculó automáticamente
SELECT 
  id,
  nombre,
  peso_kg as "Peso Calculado (debe ser > 0)",
  quantity,
  peso_kg * quantity as "Peso Total"
FROM b2b_cart_items
WHERE sku = 'TEST-SKU';

-- ESPERADO: peso_kg debe ser > 0 (calculado automáticamente)
```

### 2. Test del Trigger de Costo de Envío

```sql
-- Verificar que el carrito tiene costo actualizado
SELECT 
  id,
  total_weight_kg as "Peso Total",
  shipping_cost_usd as "Costo Envío",
  last_shipping_update as "Última Actualización"
FROM b2b_carts
WHERE status = 'open';

-- ESPERADO: 
-- - total_weight_kg > 0
-- - shipping_cost_usd > 0
-- - last_shipping_update = tiempo reciente
```

### 3. Test Frontend

```typescript
// En SellerCartPage.tsx o CartSidebarB2B.tsx
console.log('Items del carrito:', cartItems.map(item => ({
  nombre: item.nombre,
  peso_kg: item.peso_kg, // ✅ Debe estar calculado
  quantity: item.quantity,
  peso_total: item.peso_kg * item.quantity
})));

console.log('Costo de envío:', cartShippingCost.total_cost_with_type);
// ✅ Debe ser > 0 inmediatamente después de agregar producto
```

---

## 📦 SCRIPTS A EJECUTAR (EN ORDEN)

1. **Crear trigger de peso:**
   ```bash
   TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql
   ```

2. **Actualizar items existentes (una sola vez):**
   ```bash
   ACTUALIZAR_PESO_ITEMS_AHORA.sql
   ```

3. **Opcional - Trigger de costo total:**
   ```bash
   TRIGGER_AUTO_CALCULAR_COSTO_ENVIO_CARRITO.sql
   ```

4. **Verificar:**
   ```sql
   -- Ver triggers instalados
   SELECT 
     trigger_name,
     event_manipulation,
     event_object_table,
     action_timing
   FROM information_schema.triggers
   WHERE trigger_name LIKE '%cart%';
   ```

---

## 🎯 BENEFICIOS

### ✅ **Automatización Completa**
- No más scripts manuales
- El peso se calcula al momento de agregar al carrito
- Consistencia garantizada en todos los casos

### ✅ **Experiencia de Usuario Mejorada**
- Costo de envío visible instantáneamente (como Shein/Temu)
- No hay sorpresas al momento del checkout
- Frontend recibe datos correctos desde el inicio

### ✅ **Mejor Performance**
- Un solo INSERT/UPDATE en lugar de INSERT + UPDATE manual
- Vista `v_cart_shipping_costs` siempre tiene datos correctos
- Menos carga en el servidor (no hay script periódico)

### ✅ **Mantenibilidad**
- Lógica centralizada en triggers
- Si cambia la fórmula de cálculo, se actualiza en un solo lugar
- Funciona incluso si alguien inserta datos desde SQL directo

---

## 🚀 ALTERNATIVA RÁPIDA (Si no puedes crear triggers)

Si no tienes permisos para crear triggers, puedes usar una función RPC y llamarla desde TypeScript:

```sql
-- Crear función RPC
CREATE OR REPLACE FUNCTION calculate_and_set_item_weight(p_cart_item_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_peso_kg NUMERIC;
BEGIN
  UPDATE b2b_cart_items
  SET peso_kg = (
    CASE 
      WHEN variant_id IS NOT NULL THEN
        (SELECT COALESCE(NULLIF(pv.peso_kg, 0), NULLIF(p.peso_kg, 0), 
                         pv.peso_g::numeric / 1000.0, p.peso_g::numeric / 1000.0, 0.3)
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE pv.id = variant_id)
      ELSE
        (SELECT COALESCE(NULLIF(p.peso_kg, 0), p.peso_g::numeric / 1000.0, 0.3)
         FROM products p
         WHERE p.id = product_id)
    END
  )
  WHERE id = p_cart_item_id
  RETURNING peso_kg INTO v_peso_kg;
  
  RETURN v_peso_kg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```typescript
// En cartService.ts después de INSERT
const { data: inserted } = await supabase.from('b2b_cart_items').insert(...);

// Calcular peso inmediatamente
const { data: peso } = await supabase.rpc('calculate_and_set_item_weight', {
  p_cart_item_id: inserted[0].id
});

console.log('Peso calculado:', peso);
```

**Desventajas de esta alternativa:**
- ❌ Requiere actualizar el código en múltiples lugares
- ❌ Dos llamadas a DB (INSERT + RPC)
- ❌ Si olvidamos llamar la función, datos inconsistentes

---

## 💡 DECISIÓN FINAL: OPCIÓN B - TARIFAS REALES

**✅ Implementación con Sistema de Tarifas Reales Configurables**

**Por qué esta opción:**
1. Ya existe infraestructura completa de tarifas (`shipping_tiers`, `shipping_routes`, etc.)
2. Sistema escalable para múltiples destinos y tipos de envío
3. Tarifas modificables sin redeployar código
4. Funciona como sistemas profesionales (Shein/Temu)
5. Cálculos más precisos según logística real

**Orden de implementación (Opción B):**
1. ✅ **Verificar Sistema:** Ejecutar `VERIFICAR_SISTEMA_TARIFAS_REALES.sql`
2. ✅ **Configurar Datos:** Si faltan, ejecutar `CONFIGURAR_TARIFAS_REALES.sql`
3. ✅ **Trigger de Peso:** Instalar `TRIGGER_AUTO_CALCULAR_PESO_CART_ITEMS.sql`
4. ✅ **Trigger de Tarifas Reales:** Instalar `TRIGGER_AUTO_CALCULAR_COSTO_TARIFA_REAL.sql`
5. ✅ **Actualizar Existentes:** Ejecutar `ACTUALIZAR_PESO_ITEMS_AHORA.sql` (una vez)
6. ✅ **Testing:** Verificar con carritos reales

**Archivos creados para Opción B:**
- `VERIFICAR_SISTEMA_TARIFAS_REALES.sql` - Pre-flight check
- `CONFIGURAR_TARIFAS_REALES.sql` - Inicializar tarifas
- `TRIGGER_AUTO_CALCULAR_COSTO_TARIFA_REAL.sql` - Trigger con tarifas reales
- `GUIA_IMPLEMENTACION_OPCION_B.md` - Guía paso a paso completa
- `EXPLICACION_FORMULA_COSTOS.md` - Documentación de sistemas

---

## 📞 PRÓXIMOS PASOS

1. **Revisar este plan** con el equipo
2. **Ejecutar Fase 1** (crear trigger de peso)
3. **Ejecutar Fase 2** (actualizar items existentes)
4. **Testear** agregando productos al carrito
5. **Verificar** que el costo se actualiza automáticamente
6. **Implementar Fase 3** (opcional) para optimizar frontend

¿Quieres que implemente alguna de estas fases ahora?
