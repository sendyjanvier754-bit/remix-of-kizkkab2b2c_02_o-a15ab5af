# EJECUTAR MIGRACIÓN: Tipos de Envío Vinculados a Rutas

## Paso 1: Abrir Supabase SQL Editor

1. Ve a: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a: **SQL Editor** (lado izquierdo)
4. Click en **New Query**

---

## Paso 2: Copiar y Ejecutar la Migración

### Opción A: Copiar el archivo completo (RECOMENDADO)

1. En VS Code, abre: `supabase/migrations/20260210_shipping_types_linked_to_routes.sql`
2. Selecciona TODO el contenido (Ctrl+A)
3. Cópialo (Ctrl+C)
4. En Supabase SQL Editor, pega todo el código
5. Click en botón **RUN** (esquina superior derecha)

### Opción B: Si tienes líneas de error, ejecuta paso a paso:

```sql
-- PASO 1: Agregar columnas a shipping_tiers
ALTER TABLE public.shipping_tiers
ADD COLUMN IF NOT EXISTS extra_surcharge_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_surcharge_fixed NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS surcharge_description VARCHAR(255);
```

Luego ejecuta:

```sql
-- PASO 2: Crear tabla shipping_type_configs
CREATE TABLE IF NOT EXISTS public.shipping_type_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.shipping_routes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  shipping_tier_id UUID NOT NULL REFERENCES public.shipping_tiers(id) ON DELETE RESTRICT,
  
  extra_cost_fixed NUMERIC(10,2) DEFAULT 0,
  extra_cost_percent NUMERIC(5,2) DEFAULT 0,
  
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  allows_oversize BOOLEAN DEFAULT true,
  allows_sensitive BOOLEAN DEFAULT true,
  min_weight_kg NUMERIC(10,4) DEFAULT 0,
  max_weight_kg NUMERIC(10,4),
  
  is_active BOOLEAN DEFAULT true,
  priority_order INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(route_id, type),
  
  CONSTRAINT tier_belongs_to_route 
  CHECK ((SELECT route_id FROM shipping_tiers WHERE id = shipping_tier_id) = route_id)
);

ALTER TABLE public.shipping_type_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping type configs viewable by authenticated" ON public.shipping_type_configs 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage shipping type configs" ON public.shipping_type_configs 
FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
```

Luego ejecuta:

```sql
-- PASO 3: Crear índices
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_route_id ON public.shipping_type_configs(route_id);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_tier_id ON public.shipping_type_configs(shipping_tier_id);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_type ON public.shipping_type_configs(type);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_active ON public.shipping_type_configs(is_active) WHERE is_active = true;
```

---

## Paso 3: Verificar que se creó correctamente

Ejecuta esta query para verificar:

```sql
-- Verificar que la tabla se creó
SELECT 
  table_name 
FROM 
  information_schema.tables 
WHERE 
  table_schema = 'public' 
  AND table_name = 'shipping_type_configs';
```

Deberías ver:
```
table_name
──────────────────────────
shipping_type_configs
```

---

## Paso 4: Crear la Función de Cálculo

Ejecuta esta query para crear la función que calcula costos:

```sql
CREATE OR REPLACE FUNCTION public.calculate_shipping_cost_with_type(
  p_weight_kg NUMERIC,
  p_shipping_tier_id UUID,
  p_shipping_type_config_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_cost NUMERIC,
  base_cost NUMERIC,
  extra_cost NUMERIC,
  tier_type VARCHAR,
  display_name VARCHAR
) AS $$
DECLARE
  v_tramo_a_cost NUMERIC;
  v_tramo_b_cost NUMERIC;
  v_base_cost NUMERIC;
  v_extra_cost NUMERIC := 0;
  v_type VARCHAR;
  v_display_name VARCHAR;
BEGIN
  -- Obtener costos base del tier
  SELECT 
    st.tier_type,
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb
  INTO v_type, v_tramo_a_cost, v_tramo_b_cost
  FROM shipping_tiers st
  WHERE st.id = p_shipping_tier_id;
  
  IF v_type IS NULL THEN
    RETURN QUERY SELECT NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::VARCHAR, NULL::VARCHAR;
    RETURN;
  END IF;
  
  -- Calcular costo base
  v_base_cost := (p_weight_kg * v_tramo_a_cost) + (p_weight_kg * 2.20462 * v_tramo_b_cost);
  v_display_name := v_type;
  
  -- Si se proporciona tipo de envío, agregar cargo extra
  IF p_shipping_type_config_id IS NOT NULL THEN
    SELECT 
      stc.extra_cost_fixed,
      stc.extra_cost_percent,
      stc.display_name
    INTO v_extra_cost, v_type, v_display_name
    FROM shipping_type_configs stc
    WHERE stc.id = p_shipping_type_config_id;
    
    IF v_extra_cost IS NULL THEN
      v_extra_cost := 0;
    END IF;
    
    -- Sumar cargos extra
    v_extra_cost := COALESCE(v_extra_cost, 0) + (v_base_cost * COALESCE(v_type, 0) / 100);
  END IF;
  
  RETURN QUERY SELECT 
    ROUND((v_base_cost + v_extra_cost)::NUMERIC, 2),
    ROUND(v_base_cost::NUMERIC, 2),
    ROUND(v_extra_cost::NUMERIC, 2),
    v_type,
    v_display_name;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Paso 5: Insertar Configuraciones Iniciales (Opcional)

Si ya tienes rutas y tiers creados, puedes auto-generar los tipos iniciales:

```sql
INSERT INTO shipping_type_configs (
  route_id,
  type,
  shipping_tier_id,
  display_name,
  description,
  extra_cost_fixed,
  extra_cost_percent,
  is_active
)
SELECT 
  st.route_id,
  st.tier_type,
  st.id,
  CASE 
    WHEN st.tier_type = 'standard' THEN 'Envío Estándar'
    WHEN st.tier_type = 'express' THEN 'Envío Express'
    ELSE INITCAP(st.tier_type || ' Envío')
  END,
  CASE 
    WHEN st.tier_type = 'standard' THEN 'Envío estándar con '||st.tramo_a_eta_max||' días de entrega'
    WHEN st.tier_type = 'express' THEN 'Envío express con '||st.tramo_a_eta_max||' días de entrega'
    ELSE st.tier_name
  END,
  0,
  0,
  st.is_active
FROM shipping_tiers st
WHERE NOT EXISTS (
  SELECT 1 FROM shipping_type_configs stc 
  WHERE stc.route_id = st.route_id AND stc.type = st.tier_type
)
ON CONFLICT (route_id, type) DO NOTHING;
```

---

## Paso 6: Probar con el Script de Ejemplo

Una vez que la migración esté ejecutada, puedes ejecutar el script de ejemplo:

Abre: `supabase/migrations/20260210_EJEMPLO_CALCULO_LOGISTICA.sql`

Y ejecuta cualquiera de los bloques SELECT para verificar que todo funciona.

---

## Verificación Final

Para confirmar que todo está configurado correctamente, ejecuta:

```sql
-- Ver todas las rutas y sus tipos de envío
SELECT 
  sr.origin_country || ' → ' || sr.destination_country as ruta,
  stc.type as tipo_envio,
  stc.display_name,
  st.tramo_a_cost_per_kg || '/kg' as tramo_a,
  st.tramo_b_cost_per_lb || '/lb' as tramo_b,
  stc.extra_cost_fixed,
  stc.extra_cost_percent || '%' as extra_percent,
  stc.is_active
FROM shipping_type_configs stc
LEFT JOIN shipping_routes sr ON stc.route_id = sr.id
LEFT JOIN shipping_tiers st ON stc.shipping_tier_id = st.id
ORDER BY sr.origin_country, sr.destination_country, stc.type;
```

---

## ¿Qué hacer si hay error?

### Error: "relation already exists"
- Esto es normal si algunos índices o columnas ya existen
- Usa `CREATE ... IF NOT EXISTS` (ya está en el script)
- Solución: Ejecuta de nuevo, ignorará lo que ya existe

### Error: "foreign key constraint fails"
- Asegúrate de que `shipping_routes` y `shipping_tiers` existan primero
- Verifica que los route_id en shipping_tiers sean válidos

### Error: "function already exists"
- Usa `CREATE OR REPLACE FUNCTION` (ya está en el script)
- Se actualizará automáticamente

---

## Resumen

Una vez ejecutada esta migración, tendrás:

✓ Tabla `shipping_type_configs` para vincular tipos a rutas
✓ Función `calculate_shipping_cost_with_type()` para cálculos
✓ Índices para queries rápidas
✓ RLS policies para seguridad
✓ Datos iniciales (si los insertaste)

Ahora puedes:
- ✓ Crear tipos de envío (Standard, Express, etc) por ruta
- ✓ Agregar cargos extras fijos y/o porcentuales
- ✓ Calcular costos automáticamente en B2B
- ✓ Mostrar desglose de costos a usuarios
