-- ============================================
-- DYNAMIC PRICING VIEW - THE SOURCE OF TRUTH
-- Migration: Centralizar cálculo de precio_b2b
-- Purpose: Reemplazar precio_b2b estático con cálculo dinámico
-- ============================================

-- ============================================
-- 1. ALTER EXISTING TABLE
-- ============================================
-- Renombrar la columna estática para referencia histórica (SOLO si existe)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'precio_mayorista'
  ) THEN
    ALTER TABLE public.products 
    RENAME COLUMN precio_mayorista TO precio_mayorista_base;
  END IF;
END $$;

-- Agregar columna para almacenar último cálculo de fees (opcional, para auditoría)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS last_fee_calculation JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================
-- 2. FUNCIÓN PARA CALCULAR PRECIO B2B DINÁMICO
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_b2b_price(
  p_product_id UUID,
  p_market_id UUID DEFAULT NULL,
  p_destination_country_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo_fabrica NUMERIC;
  v_costo_tramo_a NUMERIC := 0;
  v_costo_tramo_b NUMERIC := 0;
  v_fee_plataforma NUMERIC := 0;
  v_price_b2b NUMERIC;
  v_destination_country_id UUID;
  v_shipping_route_id UUID;
  v_weight_kg NUMERIC;
  v_weight_cbm NUMERIC;
  v_min_cost NUMERIC;
BEGIN
  -- 1. Obtener costo base del producto
  SELECT costo_base_excel, weight_kg, COALESCE(width_cm, 0) * COALESCE(height_cm, 0) * COALESCE(length_cm, 0) / 1000000.0
  INTO v_costo_fabrica, v_weight_kg, v_weight_cbm
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_costo_fabrica IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 2. Determinar país de destino
  IF p_destination_country_id IS NOT NULL THEN
    v_destination_country_id := p_destination_country_id;
  ELSIF p_market_id IS NOT NULL THEN
    SELECT destination_country_id, shipping_route_id
    INTO v_destination_country_id, v_shipping_route_id
    FROM public.markets
    WHERE id = p_market_id;
  ELSE
    -- Si no se especifica, usar el primer mercado activo como default
    SELECT destination_country_id, shipping_route_id
    INTO v_destination_country_id, v_shipping_route_id
    FROM public.markets
    WHERE is_active = true
    LIMIT 1;
  END IF;
  
  -- 3. Calcular TRAMO A (China → Hub Tránsito)
  IF v_shipping_route_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN COALESCE(cost_per_kg, 0) > 0 THEN GREATEST(cost_per_kg * COALESCE(v_weight_kg, 1), COALESCE(min_cost, 0))
        ELSE COALESCE(min_cost, 0)
      END
    INTO v_costo_tramo_a
    FROM public.route_logistics_costs
    WHERE shipping_route_id = v_shipping_route_id
      AND segment = 'china_to_transit'
      AND is_active = true
    LIMIT 1;
    
    v_costo_tramo_a := COALESCE(v_costo_tramo_a, 0);
  END IF;
  
  -- 4. Calcular TRAMO B (Hub Tránsito → País Destino)
  IF v_shipping_route_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN COALESCE(cost_per_kg, 0) > 0 THEN GREATEST(cost_per_kg * COALESCE(v_weight_kg, 1), COALESCE(min_cost, 0))
        ELSE COALESCE(min_cost, 0)
      END
    INTO v_costo_tramo_b
    FROM public.route_logistics_costs
    WHERE shipping_route_id = v_shipping_route_id
      AND segment = 'transit_to_destination'
      AND is_active = true
    LIMIT 1;
    
    v_costo_tramo_b := COALESCE(v_costo_tramo_b, 0);
  END IF;
  
  -- 5. Calcular FEE de PLATAFORMA (porcentaje sobre costo total)
  -- Fee de plataforma: típicamente 10-15% sobre el costo total
  v_fee_plataforma := (v_costo_fabrica + v_costo_tramo_a + v_costo_tramo_b) * 0.12; -- 12% default
  
  -- 6. FÓRMULA FINAL
  v_price_b2b := v_costo_fabrica + v_costo_tramo_a + v_costo_tramo_b + v_fee_plataforma;
  
  RETURN ROUND(v_price_b2b::numeric, 2);
END;
$$;

-- ============================================
-- 3. VISTA PRINCIPAL - SOURCE OF TRUTH
-- ============================================
-- Esta vista reemplaza consultas directas a productos
-- Todos los campos siguen siendo iguales, pero precio_b2b ahora es dinámico

-- Eliminar vista existente si hay conflictos de estructura
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  p.costo_base_excel,
  p.precio_mayorista_base,
  
  -- PRECIO B2B DINÁMICO - El corazón del cambio
  -- Esta columna se calcula en tiempo real
  COALESCE(
    public.calculate_b2b_price(p.id, NULL, NULL),
    p.precio_mayorista_base,
    0
  ) AS precio_b2b,
  
  -- Campos adicionales de precio
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  
  -- Información de stock
  p.moq,
  p.stock_fisico,
  p.stock_status,
  
  -- Imágenes
  p.imagen_principal,
  p.galeria_imagenes,
  
  -- Referencias
  p.categoria_id,
  p.proveedor_id,
  p.origin_country_id,
  
  -- Configuración
  p.currency_code,
  p.url_origen,
  p.peso_kg,
  p.weight_kg,
  p.dimensiones_cm,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.is_oversize,
  p.shipping_mode,
  
  -- Estado
  p.is_active,
  p.is_parent,
  
  -- Timestamps
  p.created_at,
  p.updated_at,
  p.last_calculated_at
  
FROM public.products p
WHERE p.is_active = true;

-- ============================================
-- 4. VISTA CON INFORMACIÓN DE MERCADO
-- ============================================
-- Para consultas que necesitan información del mercado

-- Eliminar vista existente si hay conflictos
DROP VIEW IF EXISTS public.v_productos_mercado_precio CASCADE;

CREATE VIEW public.v_productos_mercado_precio AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  
  -- PRECIO B2B DINÁMICO POR MERCADO
  public.calculate_b2b_price(p.id, m.id, m.destination_country_id) AS precio_b2b,
  
  p.costo_base_excel,
  p.precio_mayorista_base,
  p.stock_fisico,
  p.moq,
  p.imagen_principal,
  p.categoria_id,
  
  -- Información de mercado
  m.id AS market_id,
  m.name AS market_name,
  m.code AS market_code,
  m.currency AS market_currency,
  
  -- País de destino
  dc.id AS destination_country_id,
  dc.name AS destination_country_name,
  dc.code AS destination_country_code,
  
  -- Timestamps
  p.created_at,
  p.updated_at
  
FROM public.products p
CROSS JOIN public.markets m
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
WHERE p.is_active = true AND m.is_active = true;

-- ============================================
-- 5. VISTA PARA ADMIN - DESGLOSE DE COSTOS
-- ============================================
-- Para que el admin vea el desglose completo del cálculo

-- Eliminar vista existente si hay conflictos
DROP VIEW IF EXISTS public.v_pricing_breakdown CASCADE;

CREATE VIEW public.v_pricing_breakdown AS
SELECT
  p.id AS product_id,
  p.sku_interno,
  p.nombre,
  
  -- Desglose de costos
  p.costo_base_excel AS costo_fabrica,
  
  (SELECT 
    COALESCE(cost_per_kg * COALESCE(p.weight_kg, 1), 0)
   FROM public.route_logistics_costs rlc
   WHERE rlc.shipping_route_id = m.shipping_route_id
     AND rlc.segment = 'china_to_transit'
     AND rlc.is_active = true
   LIMIT 1) AS costo_tramo_a,
   
  (SELECT 
    COALESCE(cost_per_kg * COALESCE(p.weight_kg, 1), 0)
   FROM public.route_logistics_costs rlc
   WHERE rlc.shipping_route_id = m.shipping_route_id
     AND rlc.segment = 'transit_to_destination'
     AND rlc.is_active = true
   LIMIT 1) AS costo_tramo_b,
  
  (p.costo_base_excel * 0.12) AS fee_plataforma,
  
  -- Precio final calculado
  public.calculate_b2b_price(p.id, m.id, m.destination_country_id) AS precio_b2b_final,
  
  -- Información del mercado
  m.id AS market_id,
  m.name AS market_name,
  dc.name AS destination_country,
  
  -- Timestamps
  NOW() AS calculated_at
  
FROM public.products p
CROSS JOIN public.markets m
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
WHERE p.is_active = true AND m.is_active = true;

-- ============================================
-- 6. TRIGGER PARA AUDITORÍA
-- ============================================
-- Registrar cambios en logística que afectan precios
CREATE OR REPLACE FUNCTION public.audit_pricing_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar que cambió la logística
  RAISE NOTICE 'Pricing affected: % changed in %', TG_TABLE_NAME, TG_OP;
  -- Aquí se podría enviar a una tabla de auditoría
  RETURN NEW;
END;
$$;

-- Triggers para notificar cambios
CREATE TRIGGER trg_route_logistics_cost_changed
AFTER INSERT OR UPDATE OR DELETE ON public.route_logistics_costs
FOR EACH ROW
EXECUTE FUNCTION public.audit_pricing_changes();

-- ============================================
-- 7. POLÍTICAS RLS PARA VISTAS
-- ============================================
-- Todos pueden ver los productos con precio dinámico
ALTER VIEW public.v_productos_con_precio_b2b OWNER TO postgres;
ALTER VIEW public.v_productos_mercado_precio OWNER TO postgres;
ALTER VIEW public.v_pricing_breakdown OWNER TO postgres;

-- Grant permisos
GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_productos_mercado_precio TO anon, authenticated;
GRANT SELECT ON public.v_pricing_breakdown TO authenticated; -- Solo para usuarios logueados

-- ============================================
-- 8. ÍNDICES PARA PERFORMANCE
-- ============================================
-- Asegurar que las consultas sean rápidas
CREATE INDEX IF NOT EXISTS idx_products_active_sku 
  ON public.products(is_active, sku_interno);

CREATE INDEX IF NOT EXISTS idx_products_category 
  ON public.products(categoria_id, is_active);

CREATE INDEX IF NOT EXISTS idx_markets_active 
  ON public.markets(is_active, destination_country_id);

CREATE INDEX IF NOT EXISTS idx_route_logistics_segment 
  ON public.route_logistics_costs(shipping_route_id, segment, is_active);

-- ============================================
-- INSTRUCCIONES DE MIGRACIÓN
-- ============================================
/*
ANTES (Manual en Frontend):
- Archivo: src/components/catalog/ProductCard.tsx
- Variable: {product.precio_mayorista}
- Problema: Si admin cambio logística, no se actualiza aquí

DESPUÉS (Con Vista):
- Archivo: Mismo, NO CAMBIA
- Variable: {product.precio_b2b} (ahora dinámico)
- Ventaja: Automáticamente refleja cambios en logística

MIGRACIÓN EN FRONTEND:
1. Todos los hooks/servicios consultarán v_productos_con_precio_b2b en lugar de products
2. La variable precio_b2b seguirá siendo la misma en el código
3. El cálculo ahora viene desde la BD, no desde el frontend

EJEMPLO DE CAMBIO EN SERVICIOS:
FROM: SELECT * FROM products WHERE categoria_id = $1
TO:   SELECT * FROM v_productos_con_precio_b2b WHERE categoria_id = $1

Y ESO ES TODO. El frontend no necesita cambiar sus variables ni lógica.
*/

-- ============================================
-- NOTES FOR DEVELOPERS
-- ============================================
-- Este archivo crea la infraestructura para precios dinámicos centralizados
-- Los componentes del frontend NO necesitan cambiar
-- Solo los servicios/hooks que consultan la BD necesitan cambiar la tabla consultada
