-- ============================================================================
-- B2B SYSTEM REENGINEERING - SQL MIGRATIONS
-- Versión: 1.0 | Fecha: 31 Enero 2026
-- ============================================================================
-- PREREQUISITO: Primero ejecutar esto en orden

-- ============================================================================
-- FASE 1: EXTENDER TABLAS EXISTENTES
-- ============================================================================

-- 1.1: Extender PRODUCTS con atributos B2B
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS weight_g INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS dimensions_length_cm NUMERIC,
ADD COLUMN IF NOT EXISTS dimensions_width_cm NUMERIC,
ADD COLUMN IF NOT EXISTS dimensions_height_cm NUMERIC,
ADD COLUMN IF NOT EXISTS is_oversize BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sensitivity_type VARCHAR, -- 'liquid', 'battery', 'fragile'
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Columna calculada para volumen
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS volume_cm3_calculated NUMERIC GENERATED ALWAYS AS 
  (COALESCE(dimensions_length_cm, 0) * 
   COALESCE(dimensions_width_cm, 0) * 
   COALESCE(dimensions_height_cm, 0)) STORED;

-- Índice para performance (filtrar sin peso)
CREATE INDEX IF NOT EXISTS idx_products_weight ON public.products(weight_g) WHERE weight_g > 0;
CREATE INDEX IF NOT EXISTS idx_products_sensitive ON public.products(is_sensitive) WHERE is_sensitive = true;

-- 1.2: Extender COMMUNES con zona
ALTER TABLE public.communes
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.shipping_zones(id),
ADD COLUMN IF NOT EXISTS zone_surcharge NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_coverable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_standard_days INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS delivery_express_days INT DEFAULT 5;

-- Índice para búsqueda rápida por zona
CREATE INDEX IF NOT EXISTS idx_communes_zone ON public.communes(zone_id, country_id);

-- ============================================================================
-- FASE 2: CREAR NUEVAS TABLAS
-- ============================================================================

-- 2.1: SHIPPING_ZONES (Zonificación)
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES public.destination_countries(id) ON DELETE CASCADE,
  zone_code VARCHAR UNIQUE,
  zone_name VARCHAR, -- "Capital", "Provincias", "Zona Remota"
  zone_level INT, -- 1=Capital, 2=Urbana, 3=Rural, 4=Muy Remota
  zone_surcharge NUMERIC DEFAULT 0, -- Recargo adicional por zona (en USD)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_zones_country ON public.shipping_zones(country_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_level ON public.shipping_zones(zone_level);

-- 2.2: SHIPPING_TIERS (Tipos de envío por ruta)
CREATE TABLE IF NOT EXISTS public.shipping_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_route_id UUID REFERENCES public.shipping_routes(id) ON DELETE CASCADE,
  tier_type VARCHAR DEFAULT 'standard', -- 'standard' o 'express'
  
  -- TRAMO A: China → Transit Hub (costo por KG)
  tramo_a_cost_per_kg NUMERIC NOT NULL,
  tramo_a_min_cost NUMERIC NOT NULL, -- Costo mínimo por envío
  tramo_a_eta_min INT DEFAULT 7, -- días mínimos
  tramo_a_eta_max INT DEFAULT 14, -- días máximos
  
  -- TRAMO B: Transit Hub → Destination (costo por LB)
  tramo_b_cost_per_lb NUMERIC NOT NULL,
  tramo_b_min_cost NUMERIC NOT NULL,
  tramo_b_eta_min INT DEFAULT 2,
  tramo_b_eta_max INT DEFAULT 5,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_route_tier UNIQUE(shipping_route_id, tier_type)
);

CREATE INDEX IF NOT EXISTS idx_shipping_tiers_route ON public.shipping_tiers(shipping_route_id, tier_type);

-- 2.3: MASTER_PURCHASE_ORDERS (PO Maestra - Ciclo perpetuo)
CREATE TABLE IF NOT EXISTS public.master_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR UNIQUE, -- [PAÍS-DEPTO-XXXXXX]
  country_id UUID REFERENCES public.destination_countries(id),
  commune_id UUID REFERENCES public.communes(id),
  investor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Estados
  status VARCHAR DEFAULT 'open', -- open, preparing, shipped, delivered
  
  -- Metadata
  total_weight_g NUMERIC DEFAULT 0,
  total_weight_facturable_kg NUMERIC DEFAULT 0,
  total_weight_facturable_lb NUMERIC DEFAULT 0,
  total_items INT DEFAULT 0,
  total_shipping_cost NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  
  -- Flags
  has_express BOOLEAN DEFAULT false,
  has_oversize BOOLEAN DEFAULT false,
  has_sensitive BOOLEAN DEFAULT false,
  
  -- Timeline
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  preparing_eta TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_country_investor ON public.master_purchase_orders(country_id, investor_id, status);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.master_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_opened_at ON public.master_purchase_orders(opened_at);

-- 2.4: PO_ITEMS (Items dentro de cada PO)
CREATE TABLE IF NOT EXISTS public.po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.master_purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL, -- Precio unitario en el momento
  total_price NUMERIC NOT NULL, -- Cantidad × precio unitario
  weight_g NUMERIC NOT NULL,
  shipping_cost NUMERIC NOT NULL,
  
  -- Flags heredados del producto
  is_sensitive BOOLEAN DEFAULT false,
  is_oversize BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON public.po_items(product_id);

-- 2.5: PO_TRACKING_IDS (ID de rastreo inteligente)
CREATE TABLE IF NOT EXISTS public.po_tracking_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.master_purchase_orders(id) ON DELETE CASCADE,
  internal_id VARCHAR UNIQUE, -- [PAÍS-DEPTO-PO-HUB-XXXX-SUFFIX]
  
  -- Sufijos
  has_express BOOLEAN DEFAULT false,
  has_oversize BOOLEAN DEFAULT false,
  has_sensitive BOOLEAN DEFAULT false,
  
  -- Packing instruction
  packing_instruction VARCHAR, -- 'Standard Box', 'Special Packaging', 'Careful Handling'
  priority_level VARCHAR DEFAULT 'normal', -- 'normal', 'urgent', 'high'
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_tracking_po ON public.po_tracking_ids(po_id);
CREATE INDEX IF NOT EXISTS idx_po_tracking_internal_id ON public.po_tracking_ids(internal_id);

-- ============================================================================
-- FASE 3: FUNCIONES PostgreSQL (MOTOR DE PRECIOS)
-- ============================================================================

-- 3.1: MAIN PRICING FUNCTION
CREATE OR REPLACE FUNCTION public.calculate_b2b_price_multitramo(
  p_product_id UUID,
  p_address_id UUID,
  p_tier_type VARCHAR DEFAULT 'standard',
  p_quantity INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_address RECORD;
  v_route RECORD;
  v_tier RECORD;
  v_weight_g NUMERIC;
  v_weight_kg_facturable NUMERIC;
  v_weight_lb_facturable NUMERIC;
  v_volume_cm3 NUMERIC;
  v_cost_tramo_a NUMERIC;
  v_cost_tramo_b NUMERIC;
  v_cost_sensible NUMERIC := 0;
  v_cost_oversize NUMERIC := 0;
  v_cost_zone_surcharge NUMERIC := 0;
  v_cost_platform_fee NUMERIC;
  v_subtotal_logistics NUMERIC;
  v_final_price NUMERIC;
  v_eta_min INT;
  v_eta_max INT;
  v_cost_base NUMERIC;
BEGIN
  -- 1. Obtener producto
  SELECT id, weight_g, dimensions_length_cm, dimensions_width_cm, dimensions_height_cm, 
         is_oversize, is_sensitive, costo_base_excel
  INTO v_product
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Producto no encontrado',
      'valid', false
    );
  END IF;
  
  -- Validación: peso debe ser > 0
  IF COALESCE(v_product.weight_g, 0) = 0 THEN
    RETURN jsonb_build_object(
      'error', 'Producto sin peso (oculto en catálogo B2B)',
      'valid', false,
      'product_id', p_product_id
    );
  END IF;
  
  -- 2. Convertir a gramos (considerando cantidad)
  v_weight_g := v_product.weight_g * p_quantity;
  v_cost_base := COALESCE(v_product.costo_base_excel, 0);
  
  -- 3. Obtener dirección y zona
  SELECT dc.id, c.id, c.zone_level, c.zone_surcharge
  INTO v_address
  FROM public.addresses a
  JOIN public.communes c ON a.commune_id = c.id
  JOIN public.destination_countries dc ON c.country_id = dc.id
  WHERE a.id = p_address_id;
  
  IF v_address IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Dirección no encontrada',
      'valid', false
    );
  END IF;
  
  -- 4. Obtener ruta y tier
  SELECT sr.*, st.*
  INTO v_route, v_tier
  FROM public.shipping_routes sr
  LEFT JOIN public.shipping_tiers st ON sr.id = st.shipping_route_id
  WHERE sr.destination_country_id = v_address.id
    AND st.tier_type = p_tier_type
    AND st.is_active = true
  LIMIT 1;
  
  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Sin cobertura logística en esta zona',
      'valid', false,
      'tier_type', p_tier_type,
      'zone_level', v_address.zone_level
    );
  END IF;
  
  -- 5. Calcular peso facturable TRAMO A (KG - China → USA)
  v_weight_kg_facturable := CEIL(v_weight_g::NUMERIC / 1000.0);
  
  -- 6. Costo TRAMO A
  v_cost_tramo_a := GREATEST(
    v_weight_kg_facturable * v_tier.tramo_a_cost_per_kg,
    v_tier.tramo_a_min_cost
  );
  
  -- 7. Calcular peso facturable TRAMO B (LB - USA → Destino)
  -- Conversión: 1 LB = 453.592 gramos
  v_weight_lb_facturable := CEIL(v_weight_g::NUMERIC / 453.592);
  
  -- Mínimo facturable: 1 LB
  IF v_weight_lb_facturable < 1 THEN
    v_weight_lb_facturable := 1;
  END IF;
  
  -- 8. Costo TRAMO B
  v_cost_tramo_b := GREATEST(
    v_weight_lb_facturable * v_tier.tramo_b_cost_per_lb,
    v_tier.tramo_b_min_cost
  );
  
  -- 9. Recargo por Oversize (si aplica)
  IF v_product.is_oversize THEN
    v_volume_cm3 := (COALESCE(v_product.dimensions_length_cm, 0) * 
                     COALESCE(v_product.dimensions_width_cm, 0) * 
                     COALESCE(v_product.dimensions_height_cm, 0));
    -- Recargo: $0.15 por cada 6000 cm3
    v_cost_oversize := ROUND((v_volume_cm3 / 6000.0) * 0.15, 2);
  END IF;
  
  -- 10. Recargo por Sensible (si aplica)
  IF v_product.is_sensitive THEN
    -- $0.05 por gramo de producto sensible
    v_cost_sensible := ROUND((v_weight_g * 0.05), 2);
  END IF;
  
  -- 11. Recargo por Zona
  v_cost_zone_surcharge := COALESCE(v_address.zone_surcharge, 0);
  
  -- 12. Subtotal logística (sin fees)
  v_subtotal_logistics := v_cost_tramo_a + v_cost_tramo_b 
                         + v_cost_sensible + v_cost_oversize 
                         + v_cost_zone_surcharge;
  
  -- 13. Platform Fee (12% sobre base + logística)
  v_cost_platform_fee := ROUND(((v_cost_base + v_subtotal_logistics) * 0.12), 2);
  
  -- 14. Precio final aterrizado
  v_final_price := v_cost_base + v_subtotal_logistics + v_cost_platform_fee;
  
  -- 15. Calcular ETA
  v_eta_min := v_tier.tramo_a_eta_min + v_tier.tramo_b_eta_min;
  v_eta_max := v_tier.tramo_a_eta_max + v_tier.tramo_b_eta_max;
  
  -- 16. Retornar resultado completo
  RETURN jsonb_build_object(
    'valid', true,
    'producto_id', p_product_id,
    'cantidad', p_quantity,
    'peso_total_gramos', v_weight_g,
    'peso_facturable_kg', v_weight_kg_facturable,
    'peso_facturable_lb', v_weight_lb_facturable,
    'desglose', jsonb_build_object(
      'costo_fabrica', ROUND(v_cost_base, 2),
      'tramo_a_china_usa_kg', ROUND(v_cost_tramo_a, 2),
      'tramo_b_usa_destino_lb', ROUND(v_cost_tramo_b, 2),
      'recargo_sensible', ROUND(v_cost_sensible, 2),
      'recargo_oversize', ROUND(v_cost_oversize, 2),
      'recargo_zona', ROUND(v_cost_zone_surcharge, 2),
      'platform_fee_12pct', ROUND(v_cost_platform_fee, 2)
    ),
    'precio_aterrizado', ROUND(v_final_price, 2),
    'precio_unitario', ROUND((v_final_price / p_quantity), 2),
    'shipping_type', p_tier_type,
    'eta_dias_min', v_eta_min,
    'eta_dias_max', v_eta_max,
    'zone_level', v_address.zone_level
  );
END;
$$;

-- 3.2: Validar producto para shipping
CREATE OR REPLACE FUNCTION public.validate_product_for_shipping(
  p_product_id UUID,
  p_tier_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_valid BOOLEAN := true;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', ARRAY['Producto no encontrado']
    );
  END IF;
  
  -- Validación 1: Peso no puede ser 0
  IF COALESCE(v_product.weight_g, 0) = 0 THEN
    v_valid := false;
    v_errors := array_append(v_errors, 'Producto sin peso - bloqueado en B2B');
  END IF;
  
  -- Validación 2: Oversize solo permite Standard
  IF v_product.is_oversize AND p_tier_type = 'express' THEN
    v_valid := false;
    v_errors := array_append(v_errors, 'Productos Oversize solo vía envío Standard');
  END IF;
  
  -- Validación 3: Dimensiones requeridas si es Oversize
  IF v_product.is_oversize THEN
    IF (v_product.dimensions_length_cm IS NULL OR
        v_product.dimensions_width_cm IS NULL OR
        v_product.dimensions_height_cm IS NULL) THEN
      v_valid := false;
      v_errors := array_append(v_errors, 'Oversize requiere dimensiones completas (L×W×H)');
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', v_valid,
    'product_id', p_product_id,
    'tier_type', p_tier_type,
    'is_oversize', v_product.is_oversize,
    'is_sensitive', v_product.is_sensitive,
    'errors', v_errors
  );
END;
$$;

-- ============================================================================
-- FASE 4: FUNCIONES PO MAESTRA
-- ============================================================================

-- 4.1: Generar ID de rastreo inteligente
CREATE OR REPLACE FUNCTION public.generate_po_tracking_id(
  p_po_id UUID
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po RECORD;
  v_country_code VARCHAR;
  v_commune_code VARCHAR;
  v_po_sequence INT;
  v_suffix VARCHAR := '';
  v_tracking_id VARCHAR;
BEGIN
  -- Obtener datos de PO
  SELECT po.*, dc.code, c.code
  INTO v_po, v_country_code, v_commune_code
  FROM public.master_purchase_orders po
  JOIN public.destination_countries dc ON po.country_id = dc.id
  JOIN public.communes c ON po.commune_id = c.id
  WHERE po.id = p_po_id;
  
  IF v_po IS NULL THEN
    RAISE EXCEPTION 'PO no encontrada: %', p_po_id;
  END IF;
  
  -- Contar POs cerradas del mismo país para secuencia
  SELECT COUNT(*) INTO v_po_sequence
  FROM public.master_purchase_orders
  WHERE country_id = v_po.country_id 
    AND closed_at IS NOT NULL
    AND status IN ('preparing', 'shipped', 'delivered');
  
  -- Incrementar para siguiente
  v_po_sequence := v_po_sequence + 1;
  
  -- Construir sufijo con flags
  IF v_po.has_express THEN
    v_suffix := v_suffix || '-EXP';
  END IF;
  IF v_po.has_oversize THEN
    v_suffix := v_suffix || '-OVZ';
  END IF;
  IF v_po.has_sensitive THEN
    v_suffix := v_suffix || '-SEN';
  END IF;
  
  -- Formato: [PAÍS-DEPTO-PO-XXXX-SUFFIX]
  -- Ejemplo: HT-PORT-PO-0001-EXP-OVZ
  v_tracking_id := v_country_code || '-' || v_commune_code || '-PO-' 
                   || LPAD(v_po_sequence::VARCHAR, 4, '0') || v_suffix;
  
  RETURN v_tracking_id;
END;
$$;

-- 4.2: Cerrar PO actual y abrir nueva (ciclo perpetuo)
CREATE OR REPLACE FUNCTION public.close_po_and_open_new(
  p_po_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po RECORD;
  v_new_po_id UUID;
  v_tracking_id VARCHAR;
BEGIN
  -- Obtener PO actual
  SELECT * INTO v_po FROM public.master_purchase_orders WHERE id = p_po_id;
  
  IF v_po IS NULL THEN
    RAISE EXCEPTION 'PO no encontrada: %', p_po_id;
  END IF;
  
  -- Cerrar PO actual
  UPDATE public.master_purchase_orders
  SET status = 'preparing',
      closed_at = now(),
      updated_at = now()
  WHERE id = p_po_id;
  
  -- Generar tracking ID para PO cerrada
  v_tracking_id := public.generate_po_tracking_id(p_po_id);
  
  -- Insertar tracking ID
  INSERT INTO public.po_tracking_ids (po_id, internal_id, has_express, has_oversize, has_sensitive)
  VALUES (p_po_id, v_tracking_id, v_po.has_express, v_po.has_oversize, v_po.has_sensitive);
  
  -- Crear nueva PO (abierta, lista para recibir items)
  INSERT INTO public.master_purchase_orders (
    country_id, 
    commune_id, 
    investor_id, 
    status, 
    opened_at,
    created_at
  ) VALUES (
    v_po.country_id, 
    v_po.commune_id, 
    v_po.investor_id, 
    'open', 
    now(),
    now()
  ) RETURNING id INTO v_new_po_id;
  
  RETURN jsonb_build_object(
    'closed_po_id', p_po_id,
    'tracking_id', v_tracking_id,
    'new_po_id', v_new_po_id,
    'new_po_status', 'open',
    'message', 'PO cerrada y nueva abierta para ciclo perpetuo'
  );
END;
$$;

-- 4.3: Actualizar flags de PO basado en items
CREATE OR REPLACE FUNCTION public.update_po_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po RECORD;
BEGIN
  -- Obtener PO y verificar si tiene items con flags
  SELECT COUNT(*) FILTER (WHERE is_express = true)::BOOLEAN,
         COUNT(*) FILTER (WHERE is_oversize = true)::BOOLEAN,
         COUNT(*) FILTER (WHERE is_sensitive = true)::BOOLEAN
  INTO v_po.has_express, v_po.has_oversize, v_po.has_sensitive
  FROM public.po_items
  WHERE po_id = NEW.po_id OR po_id = OLD.po_id;
  
  -- Actualizar PO
  UPDATE public.master_purchase_orders
  SET has_express = v_po.has_express,
      has_oversize = v_po.has_oversize,
      has_sensitive = v_po.has_sensitive,
      updated_at = now()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_po_flags
AFTER INSERT OR UPDATE OR DELETE ON public.po_items
FOR EACH ROW
EXECUTE FUNCTION public.update_po_flags();

-- ============================================================================
-- FASE 5: VISTAS SQL (Para consultas rápidas)
-- ============================================================================

-- 5.1: Vista: Producto con precio B2B
CREATE OR REPLACE VIEW public.v_products_b2b AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.costo_base_excel,
  p.weight_g,
  p.dimensions_length_cm,
  p.dimensions_width_cm,
  p.dimensions_height_cm,
  p.volume_cm3_calculated,
  p.is_oversize,
  p.is_sensitive,
  p.sensitivity_type,
  CASE 
    WHEN p.weight_g = 0 THEN false
    ELSE true
  END AS visible_in_b2b,
  CASE 
    WHEN p.is_oversize AND p.is_sensitive THEN 'oversize_sensitive'
    WHEN p.is_oversize THEN 'oversize'
    WHEN p.is_sensitive THEN 'sensitive'
    ELSE 'standard'
  END AS product_class
FROM public.products p
WHERE p.weight_g > 0;

-- 5.2: Vista: Opciones de envío por dirección
CREATE OR REPLACE VIEW public.v_shipping_options_by_country AS
SELECT 
  sr.destination_country_id,
  sr.id AS route_id,
  dc.country_name,
  st.tier_type,
  st.tramo_a_cost_per_kg,
  st.tramo_a_min_cost,
  st.tramo_a_eta_min,
  st.tramo_a_eta_max,
  st.tramo_b_cost_per_lb,
  st.tramo_b_min_cost,
  st.tramo_b_eta_min,
  st.tramo_b_eta_max,
  (st.tramo_a_eta_min + st.tramo_b_eta_min) AS eta_min_total,
  (st.tramo_a_eta_max + st.tramo_b_eta_max) AS eta_max_total
FROM public.shipping_routes sr
JOIN public.shipping_tiers st ON sr.id = st.shipping_route_id
JOIN public.destination_countries dc ON sr.destination_country_id = dc.id
WHERE st.is_active = true;

-- 5.3: Vista: POs abiertas por inversor
CREATE OR REPLACE VIEW public.v_open_pos_by_investor AS
SELECT 
  po.id,
  po.po_number,
  po.investor_id,
  dc.country_name,
  c.commune_name,
  po.status,
  COUNT(poi.id) AS item_count,
  SUM(poi.quantity) AS total_quantity,
  SUM(poi.total_price) AS total_value,
  po.has_express,
  po.has_oversize,
  po.has_sensitive,
  po.opened_at
FROM public.master_purchase_orders po
LEFT JOIN public.po_items poi ON po.id = poi.po_id
LEFT JOIN public.destination_countries dc ON po.country_id = dc.id
LEFT JOIN public.communes c ON po.commune_id = c.id
WHERE po.status = 'open'
GROUP BY po.id, dc.country_name, c.commune_name;

-- ============================================================================
-- FASE 6: RLS POLICIES (Seguridad de datos)
-- ============================================================================

-- Habilitar RLS en tablas críticas
ALTER TABLE public.shipping_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_tracking_ids ENABLE ROW LEVEL SECURITY;

-- Política: Solo investors pueden ver sus POs
CREATE POLICY "b2b_investors_own_pos"
ON public.master_purchase_orders
FOR SELECT
USING (auth.uid() = investor_id OR auth.role() = 'admin');

CREATE POLICY "b2b_investors_insert_own_pos"
ON public.master_purchase_orders
FOR INSERT
WITH CHECK (auth.uid() = investor_id);

-- Política: Solo pueden ver items de POs propios
CREATE POLICY "b2b_investors_own_items"
ON public.po_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.master_purchase_orders po
    WHERE po.id = po_items.po_id
    AND (po.investor_id = auth.uid() OR auth.role() = 'admin')
  )
);

-- ============================================================================
-- FASE 7: ÍNDICES DE PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_po_investor_status ON public.master_purchase_orders(investor_id, status);
CREATE INDEX IF NOT EXISTS idx_po_items_weight ON public.po_items(weight_g);
CREATE INDEX IF NOT EXISTS idx_shipping_tiers_active ON public.shipping_tiers(is_active, tier_type);
CREATE INDEX IF NOT EXISTS idx_products_oversize_sensitive ON public.products(is_oversize, is_sensitive) WHERE weight_g > 0;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar que todas las tablas fueron creadas
SELECT 'TABLAS CREADAS:' as status,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('shipping_zones', 'shipping_tiers', 'master_purchase_orders', 'po_items', 'po_tracking_ids')
GROUP BY status;

-- Verificar que todas las funciones fueron creadas
SELECT 'FUNCIONES CREADAS:' as status,
  COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'calculate_%' 
    OR routine_name LIKE 'validate_%'
    OR routine_name LIKE 'generate_%'
    OR routine_name LIKE 'close_%'
    OR routine_name LIKE 'update_%'
GROUP BY status;

-- ============================================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- ============================================================================

-- Insertar zona de ejemplo
-- INSERT INTO public.shipping_zones (country_id, zone_code, zone_name, zone_level, zone_surcharge)
-- VALUES (gen_random_uuid(), 'HT-CAP', 'Capital Haití', 1, 0);

-- ============================================================================
-- FIN DE MIGRACIONES
-- ============================================================================

