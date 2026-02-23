-- =============================================================================
-- FIX: v_productos_con_precio_b2b — peso_kg y weight_kg usan COALESCE
-- Problema: Admin guarda peso en products.peso_g (gramos).
--           La vista pasaba p.peso_kg y p.weight_kg directamente.
--           Si sólo peso_g está configurado, ambos llegaban NULL al frontend
--           → "Sin Peso" aunque el producto tuviera peso configurado.
-- Solución: Calcular el kg real con COALESCE(peso_kg, weight_kg, peso_g/1000, 0)
-- Fecha: 2026-02-22
-- =============================================================================

DROP VIEW IF EXISTS public.v_productos_precio_base CASCADE;
DROP VIEW IF EXISTS public.v_productos_con_precio_b2b CASCADE;

CREATE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,

  -- COSTOS INTERNOS
  p.costo_base_excel AS costo_base,
  p.precio_mayorista_base,

  -- PRECIO BASE DINÁMICO (SIN LOGÍSTICA)
  COALESCE(
    public.calculate_base_price_only(p.id, 30),
    public.calculate_b2b_price(p.id, NULL, NULL),
    p.precio_mayorista_base,
    0
  ) AS precio_b2b,

  -- DESGLOSE DE PRECIO
  ROUND((p.costo_base_excel * 0.30)::numeric, 2) AS margin_value,
  ROUND((
    (p.costo_base_excel + (p.costo_base_excel * 0.30)) * 0.12
  )::numeric, 2) AS platform_fee,
  ROUND((p.costo_base_excel * 0.30 / NULLIF(p.costo_base_excel, 0) * 100)::numeric, 2) AS precio_con_margen_300,

  -- Campos adicionales de precio (referencias)
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

  -- Configuración DE ENVÍO
  p.currency_code,
  p.url_origen,

  -- ✅ FIX: peso_kg y weight_kg usan COALESCE para cubrir TODOS los campos de peso
  -- Admin guarda en peso_g (gramos) → dividimos entre 1000 como fallback
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g / 1000.0, 0)       AS peso_kg,
  COALESCE(p.peso_kg, p.weight_kg, p.peso_g / 1000.0, 0)       AS weight_kg,

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

-- Alias
CREATE VIEW public.v_productos_precio_base AS
SELECT * FROM public.v_productos_con_precio_b2b;

-- Permisos
GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_productos_precio_base    TO anon, authenticated;

-- =============================================================================
-- VERIFICACIÓN: Ejecutar después del deploy para confirmar el fix
-- =============================================================================
-- SELECT id, nombre, sku_interno,
--        peso_kg, weight_kg
-- FROM v_productos_con_precio_b2b
-- WHERE weight_kg > 0
-- LIMIT 10;
--
-- Todos los productos con peso configurado deben mostrar weight_kg > 0.
-- =============================================================================
