-- =============================================================================
-- 🎟️ TICKET #09: REEMPLAZAR VISTA v_product_shipping_costs
-- =============================================================================
-- OBJETIVO: La vista retorna $0.00 porque usa lógica vieja.
--           Reemplazarla para que use get_product_shipping_cost_by_country()
-- DEPENDE DE: TICKET #08 (función get_product_shipping_cost_by_country)
-- IMPACTO: La columna "Logística" en MiCatalogTable.tsx pasará de $0.00
--          a mostrar el costo real calculado desde shipping_tiers
-- =============================================================================
-- 
-- FLUJO ACTUAL (roto):
--   useSellerCatalog.ts
--     → supabase.from('v_product_shipping_costs').select('product_id, total_cost')
--     → retorna $0.00 para todos
--
-- FLUJO NUEVO:
--   useSellerCatalog.ts
--     → supabase.from('v_product_shipping_costs').select('product_id, total_cost')
--     → usa LATERAL join con get_product_shipping_cost_by_country()
--     → retorna costo real desde shipping_tiers (ej: $8.04, $16.08)
-- =============================================================================

-- ✅ REEMPLAZAR VISTA: v_product_shipping_costs
DROP VIEW IF EXISTS public.v_product_shipping_costs;

CREATE OR REPLACE VIEW public.v_product_shipping_costs AS
SELECT
  r.product_id,
  r.shipping_cost_usd AS total_cost,
  r.tramo_a_cost,
  r.tramo_b_cost,
  r.tier_type,
  r.tier_name,
  r.eta_min_days,
  r.eta_max_days,
  r.destination_country,
  r.is_available
FROM public.products p
CROSS JOIN LATERAL public.get_product_shipping_cost_by_country(
  p.id,
  '737ec4c2-5b5a-459b-800c-01a4b1c3fd6a'::uuid,  -- Haiti (único país activo)
  'standard'
) r
WHERE p.is_active = TRUE
  AND p.peso_kg IS NOT NULL
  AND p.peso_kg > 0
  AND r.is_available = TRUE;

-- RLS: permitir lectura a usuarios autenticados
ALTER VIEW public.v_product_shipping_costs OWNER TO postgres;

GRANT SELECT ON public.v_product_shipping_costs TO authenticated;
GRANT SELECT ON public.v_product_shipping_costs TO anon;

-- =============================================================================
-- 🧪 TESTING: Verificar resultados
-- =============================================================================

-- Ver los 5 primeros productos con su costo de envío
SELECT
  product_id,
  total_cost,       -- ← Este valor irá a la columna "Logística"
  tramo_a_cost,
  tramo_b_cost,
  tier_type,
  tier_name,
  eta_min_days,
  eta_max_days
FROM public.v_product_shipping_costs
LIMIT 5;

-- Verificar los 3 productos del catálogo
SELECT product_id, total_cost
FROM public.v_product_shipping_costs
WHERE product_id IN (
  '3f61c5dc-ed1c-491a-894e-44ae6d1e380c',  -- Tanga      → debe ser ~8.04
  '52a4c342-6d14-4765-8bb9-a1bbc7eec3f5',  -- Camiseta   → debe ser ~16.08
  '4a53679c-7168-4405-9044-0d6c0dcc0d04'   -- Zapatillas → debe ser ~16.08
);

-- =============================================================================
-- CONFIRMACIÓN:
-- 1. ¿Se creó la vista sin errores? (SÍ / NO)
-- 2. ¿Los 3 productos muestran total_cost > 0? (SÍ / NO)
-- 3. ¿Tanga ≈ 8.04, Camiseta ≈ 16.08, Zapatillas ≈ 16.08? (SÍ / NO)
-- =============================================================================
