-- 20260210_shipping_types_linked_to_routes.sql
-- Vincular "Tipos de Envío" a "Rutas y Tramos" con cargo extra opcional

-- 1. Agregar campo para cargo extra en shipping_tiers
ALTER TABLE public.shipping_tiers
ADD COLUMN IF NOT EXISTS extra_surcharge_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_surcharge_fixed NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS surcharge_description VARCHAR(255);

-- 2. Crear tabla de configuración de Tipos de Envío (Shipping Type Config)
-- Esta tabla explicita la configuración de Standard/Express para cada ruta
CREATE TABLE IF NOT EXISTS public.shipping_type_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.shipping_routes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'STANDARD', 'EXPRESS', 'PRIORITY', etc.
  shipping_tier_id UUID NOT NULL REFERENCES public.shipping_tiers(id) ON DELETE RESTRICT,
  
  -- Cargo extra específico del tipo de envío
  extra_cost_fixed NUMERIC(10,2) DEFAULT 0, -- Cargo fijo por tipo
  extra_cost_percent NUMERIC(5,2) DEFAULT 0, -- Porcentaje extra
  
  -- Descripción y metadata
  display_name VARCHAR(100) NOT NULL, -- e.g., "Envío Estándar", "Envío Express"
  description TEXT,
  
  -- Validaciones
  allows_oversize BOOLEAN DEFAULT true,
  allows_sensitive BOOLEAN DEFAULT true,
  min_weight_kg NUMERIC(10,4) DEFAULT 0,
  max_weight_kg NUMERIC(10,4),
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  priority_order INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint: Una ruta no puede tener dos tipos iguales
  UNIQUE(route_id, type)
);

ALTER TABLE public.shipping_type_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping type configs viewable by authenticated" ON public.shipping_type_configs 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage shipping type configs" ON public.shipping_type_configs 
FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Trigger para validar que el tier pertenece a la misma ruta
CREATE OR REPLACE FUNCTION public.validate_tier_belongs_to_route()
RETURNS TRIGGER AS $$
DECLARE
  v_tier_route_id UUID;
BEGIN
  -- Obtener la ruta del tier
  SELECT shipping_route_id INTO v_tier_route_id
  FROM shipping_tiers 
  WHERE id = NEW.shipping_tier_id;
  
  -- Validar que el tier pertenece a la misma ruta
  IF v_tier_route_id != NEW.route_id THEN
    RAISE EXCEPTION 'El tier debe pertenecer a la misma ruta (tier route: %, type route: %)', v_tier_route_id, NEW.route_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_tier_belongs_to_route
BEFORE INSERT OR UPDATE ON public.shipping_type_configs
FOR EACH ROW
EXECUTE FUNCTION public.validate_tier_belongs_to_route();

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_route_id ON public.shipping_type_configs(route_id);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_tier_id ON public.shipping_type_configs(shipping_tier_id);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_type ON public.shipping_type_configs(type);
CREATE INDEX IF NOT EXISTS idx_shipping_type_configs_active ON public.shipping_type_configs(is_active) WHERE is_active = true;

-- 4. Función para calcular costo total con cargo extra
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

-- 5. Insertar configuraciones de tipos de envío iniciales
-- (esta es una operación manual que debe ejecutarse después de crear rutas y tiers)
-- Ejemplo de cómo insertar:
-- INSERT INTO shipping_type_configs (route_id, type, shipping_tier_id, display_name, extra_cost_fixed, is_active)
-- VALUES (route_uuid, 'STANDARD', tier_uuid, 'Envío Estándar', 0, true);

-- 6. Comentarios para documentación
COMMENT ON TABLE shipping_type_configs IS 'Configuración de Tipos de Envío (Standard/Express/etc) vinculados a Rutas y Tramos específicos con cargo extra opcional';
COMMENT ON COLUMN shipping_type_configs.route_id IS 'Ruta de envío a la que pertenece este tipo';
COMMENT ON COLUMN shipping_type_configs.shipping_tier_id IS 'Tier de costos de la ruta que usa este tipo de envío';
COMMENT ON COLUMN shipping_type_configs.extra_cost_fixed IS 'Cargo fijo adicional específico de este tipo de envío (e.g., $2.00 extra por Express)';
COMMENT ON COLUMN shipping_type_configs.extra_cost_percent IS 'Porcentaje de cargo adicional (e.g., 10% extra por Express)';
COMMENT ON FUNCTION calculate_shipping_cost_with_type IS 'Calcula el costo total considerando tier base + cargo extra del tipo de envío';
