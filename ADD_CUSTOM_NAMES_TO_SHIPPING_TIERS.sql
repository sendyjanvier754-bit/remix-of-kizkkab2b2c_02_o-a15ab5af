-- ============================================================================
-- ✅ AGREGAR NOMBRES PERSONALIZADOS A SHIPPING_TIERS
-- ============================================================================
-- Agregar campos similares a los de shipping_routes pero para los tipos de envío

-- 1. Agregar columnas para nombres personalizados de tipos de envío
ALTER TABLE public.shipping_tiers
ADD COLUMN IF NOT EXISTS custom_tier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS tier_origin_country VARCHAR(255),
ADD COLUMN IF NOT EXISTS tier_destination_country VARCHAR(255);

-- 2. Comentarios para clarificar el uso
COMMENT ON COLUMN public.shipping_tiers.custom_tier_name IS 
  'Nombre personalizado completo del tier (ej: "Express Aéreo China - Haití")';
COMMENT ON COLUMN public.shipping_tiers.tier_origin_country IS 
  'País de origen del tier (heredado de ruta o personalizado)';
COMMENT ON COLUMN public.shipping_tiers.tier_destination_country IS 
  'País de destino del tier (heredado de ruta o personalizado)';

-- 3. Generar nombres automáticos para tiers existentes basados en sus rutas
UPDATE public.shipping_tiers st
SET 
  tier_origin_country = COALESCE(sr.origin_country, 'China'),
  tier_destination_country = COALESCE(sr.destination_country, 'Destino'),
  custom_tier_name = CASE 
    WHEN st.tier_type = 'express' THEN 'Express ' || st.transport_type || ' - ' || COALESCE(sr.route_name, 'Sin nombre')
    WHEN st.tier_type = 'standard' THEN 'Standard ' || st.transport_type || ' - ' || COALESCE(sr.route_name, 'Sin nombre')
    ELSE st.tier_name
  END
FROM public.shipping_routes sr
WHERE st.route_id = sr.id
  AND (st.custom_tier_name IS NULL OR st.tier_origin_country IS NULL);

-- 4. Para tiers sin ruta asociada, usar nombre genérico
UPDATE public.shipping_tiers
SET 
  tier_origin_country = 'China',
  tier_destination_country = 'Destino',
  custom_tier_name = tier_name || ' - ' || tier_type
WHERE custom_tier_name IS NULL;

-- ============================================================================
-- 📊 VERIFICACIÓN
-- ============================================================================

-- Ver tiers con nombres actualizados
SELECT 
  '✅ Tiers con nombres personalizados' as info,
  st.id,
  st.custom_tier_name,
  st.tier_origin_country,
  st.tier_destination_country,
  st.tier_type,
  st.transport_type,
  sr.route_name as ruta_asociada
FROM public.shipping_tiers st
LEFT JOIN public.shipping_routes sr ON st.route_id = sr.id
ORDER BY st.created_at DESC;

-- Ver estructura actualizada
SELECT 
  '📋 Columnas de shipping_tiers' as info,
  column_name,
  data_type,
  character_maximum_length,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers'
  AND column_name IN ('custom_tier_name', 'tier_origin_country', 'tier_destination_country', 'tier_name')
ORDER BY ordinal_position;

-- ============================================================================
-- 📝 RESUMEN
-- ============================================================================

/*
✅ Cambios aplicados:

1. shipping_tiers ahora tiene:
   - custom_tier_name: Nombre completo personalizable del tier (255 chars)
   - tier_origin_country: País de origen (255 chars)
   - tier_destination_country: País de destino (255 chars)

2. Tiers existentes tienen nombres autogenerados basados en:
   - Tipo de tier (Standard/Express)
   - Tipo de transporte (marítimo/aéreo/terrestre)
   - Ruta asociada

3. Frontend puede ahora:
   - Editar nombre completo del tier
   - Personalizar origen y destino del tier
   - Mostrar nombres más descriptivos

📍 Nota sobre campos:
- tier_name: Nombre corto original (ej: "Standard - Consolidado")
- custom_tier_name: Nombre completo personalizable (ej: "Express Aéreo China - Haití")
- Los campos de origen/destino se copian de la ruta pero pueden personalizarse
*/
