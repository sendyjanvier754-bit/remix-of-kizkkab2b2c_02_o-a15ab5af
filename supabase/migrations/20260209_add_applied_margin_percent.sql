-- ============================================
-- FIX: Add applied_margin_percent column to v_productos_con_precio_b2b
-- Date: 2026-02-09
-- ============================================
-- This migration adds the missing applied_margin_percent column
-- that is referenced in the frontend code (useSellerCatalog.ts)

CREATE OR REPLACE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  
  -- COSTOS BASE
  p.costo_base_excel AS costo_base,
  p.precio_mayorista_base,
  
  -- PRECIO B2B CALCULADO CON MOTOR DE PRECIO
  -- Usa la función corregida con margen 300%
  COALESCE(
    public.calculate_base_price_only(p.id, 300),
    0
  ) AS precio_b2b,
  
  -- DESGLOSE DE PRECIO (para referencia)
  ROUND((p.costo_base_excel * 4.0)::numeric, 2) AS precio_con_margen_300,
  ROUND(((p.costo_base_excel * 4.0) * 0.12)::numeric, 2) AS platform_fee,
  
  -- MARGEN APLICADO (para frontend)
  300 AS applied_margin_percent,
  
  -- Información de stock
  p.moq,
  p.stock_fisico,
  p.stock_status,
  
  -- Categoría
  p.categoria_id,
  c.name AS categoria_nombre,
  
  -- Información de envío (para logística posterior)
  p.weight_kg,
  p.width_cm,
  p.height_cm,
  p.length_cm,
  
  -- Precios sugeridos
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  
  -- Imágenes
  p.imagen_principal,
  p.galeria_imagenes,
  
  -- Metadata
  p.proveedor_id,
  p.origin_country_id,
  p.currency_code,
  p.url_origen,
  p.peso_kg,
  p.dimensiones_cm,
  p.is_oversize,
  p.shipping_mode,
  p.is_active,
  p.is_parent,
  p.created_at,
  p.updated_at,
  p.last_calculated_at
  
FROM public.products p
LEFT JOIN public.categories c ON p.categoria_id = c.id
WHERE p.is_active = true;

COMMENT ON VIEW public.v_productos_con_precio_b2b IS 
'Vista con precios B2B calculados correctamente usando motor de precio:
(Costo Base × (1 + 300%)) + Categoría + Gastos (12%)
Ejemplo: Producto con costo $0.88 → precio_b2b = $3.94
Incluye applied_margin_percent = 300 para uso del frontend';

-- ============================================
-- Verificación
-- ============================================
-- Query de prueba para verificar que la columna existe
-- SELECT 
--   id, 
--   sku_interno, 
--   precio_b2b, 
--   applied_margin_percent
-- FROM v_productos_con_precio_b2b 
-- LIMIT 5;
