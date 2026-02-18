-- ============================================================================
-- ✅ AGREGAR COLUMNA transport_type A shipping_tiers
-- ============================================================================

-- Agregar transport_type (tipo de transporte: 'maritimo', 'aereo', 'terrestre')
ALTER TABLE public.shipping_tiers
ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20) NOT NULL DEFAULT 'aereo'
CHECK (transport_type IN ('maritimo', 'aereo', 'terrestre'));

-- Actualizar tiers existentes según su tipo
-- Standard → maritimo (más lento, económico)
-- Express → aereo (más rápido, costoso)
UPDATE public.shipping_tiers
SET transport_type = CASE
  WHEN tier_type = 'standard' THEN 'maritimo'
  WHEN tier_type = 'express' THEN 'aereo'
  ELSE 'aereo'
END
WHERE transport_type IS NULL OR transport_type NOT IN ('maritimo', 'aereo', 'terrestre');

-- Verificar que se agregó correctamente
SELECT 
  '✅ Columna transport_type agregada a shipping_tiers' as info,
  column_name as columna,
  data_type as tipo,
  column_default as valor_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers'
  AND column_name = 'transport_type';

-- Ver todos los tiers actualizados
SELECT 
  '📦 Tipos de envío actualizados con transport_type' as info,
  st.id,
  st.route_id,
  st.tier_type,
  st.transport_type,
  st.tramo_a_cost_per_kg,
  st.tramo_a_eta_min || '-' || st.tramo_a_eta_max || ' días' as tramo_a_tiempo,
  st.is_active
FROM public.shipping_tiers st
ORDER BY st.created_at DESC;

-- Ver estructura completa actualizada
SELECT 
  '📋 Todas las columnas de shipping_tiers' as info,
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers'
ORDER BY ordinal_position;

-- ============================================================================
-- 📊 RESUMEN DE LO QUE HACE ESTE SCRIPT
-- ============================================================================

/*
✅ Agrega columna transport_type a shipping_tiers

🔹 Valores permitidos:
   - 'maritimo' 🚢 (barco)
   - 'aereo' ✈️ (avión)
   - 'terrestre' 🚛 (tierra)

🔹 Estrategia de actualización:
   - Standard tiers → 'maritimo' (más lento, económico)
   - Express tiers → 'aereo' (más rápido, costoso)
   - Default → 'aereo'

🔹 Ahora ambas tablas tienen transport_type:
   ✓ route_logistics_costs (tramos individuales)
   ✓ shipping_tiers (tipos de envío para clientes)

🔹 Próximos pasos:
   1. Ejecutar ADD_TRANSPORT_TYPE_TO_ROUTE_COSTS.sql
   2. Ejecutar este archivo (ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql)
   3. El frontend ya está actualizado para mostrar las 3 opciones
*/
