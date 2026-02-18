-- ============================================================================
-- 📚 ¿QUÉ ES SHIPPING_TIERS?
-- ============================================================================

-- SHIPPING_TIERS = TIPOS DE ENVÍO (las opciones que ve el cliente)
-- 
-- Son las opciones de envío que se ofrecen al cliente final:
-- - Standard: Envío económico, más lento (generalmente marítimo)
-- - Express: Envío rápido, más caro (generalmente aéreo)
--
-- Cada ruta (shipping_routes) puede tener hasta 2 shipping_tiers:
-- 1. Standard tier
-- 2. Express tier
--
-- Cada tier tiene costos FIJOS por tramo (A y B) que se configuran aquí.

-- ============================================================================
-- 📊 ESTRUCTURA DE SHIPPING_TIERS
-- ============================================================================

SELECT 
  '📋 Columnas de shipping_tiers' as info,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shipping_tiers'
ORDER BY ordinal_position;

-- ============================================================================
-- 🔗 DIFERENCIA ENTRE SHIPPING_TIERS Y ROUTE_LOGISTICS_COSTS
-- ============================================================================

-- 1️⃣ ROUTE_LOGISTICS_COSTS (tabla que acabas de ver)
-- ═══════════════════════════════════════════════════════════
-- Son los TRAMOS individuales configurables de logística
-- Ejemplo:
--   - Tramo: "Proveedor → China" (costo por kg, costo por m³)
--   - Tramo: "China → Bodega Brasil" (costo por kg, costo por m³)
--   - Tramo: "Bodega → Cliente" (costo por kg, costo por m³)
--
-- Cada tramo tiene:
--   ✓ cost_per_kg (costo por kilogramo)
--   ✓ cost_per_cbm (costo por metro cúbico)
--   ✓ min_cost (costo mínimo del tramo)
--   ✓ transport_type (maritimo/aereo/terrestre) ← NUEVO
--   ✓ estimated_days_min/max
--
-- Estos tramos se pueden combinar dinámicamente para calcular costos totales.

-- 2️⃣ SHIPPING_TIERS (tabla que estás preguntando)
-- ═══════════════════════════════════════════════════════════
-- Son los TIPOS DE ENVÍO que se muestran al cliente
-- Ejemplo:
--   - Standard: $5.50 por kg (15-30 días)
--   - Express: $12.00 por kg (5-10 días)
--
-- Cada tier tiene costos FIJOS por tramo:
--   ✓ tramo_a_cost_per_kg (China → Hub)
--   ✓ tramo_a_min_cost
--   ✓ tramo_a_eta_min/max
--   ✓ tramo_b_cost_per_lb (Hub → Destino)
--   ✓ tramo_b_min_cost
--   ✓ tramo_b_eta_min/max
--   ✓ transport_type (maritimo/aereo/terrestre) ← NUEVO
--
-- Son opciones simples para el cliente final.

-- ============================================================================
-- 🔍 VER DATOS ACTUALES EN SHIPPING_TIERS
-- ============================================================================

SELECT 
  '📦 Tipos de envío configurados' as info,
  st.id,
  sr.origin_country || ' → ' || sr.destination_country as ruta,
  st.tier_type,
  st.transport_type,
  st.tramo_a_cost_per_kg,
  st.tramo_a_eta_min || '-' || st.tramo_a_eta_max || ' días' as tramo_a_tiempo,
  st.tramo_b_cost_per_lb,
  st.tramo_b_eta_min || '-' || st.tramo_b_eta_max || ' días' as tramo_b_tiempo,
  st.is_active
FROM shipping_tiers st
JOIN shipping_routes sr ON st.shipping_route_id = sr.id
ORDER BY sr.origin_country, sr.destination_country, st.tier_type;

-- ============================================================================
-- 🎯 RESUMEN: ¿CUÁNDO USAR CADA TABLA?
-- ============================================================================

/*
┌─────────────────────────────────────────────────────────────────────┐
│ ROUTE_LOGISTICS_COSTS (Tramos configurables)                       │
├─────────────────────────────────────────────────────────────────────┤
│ Úsalo cuando:                                                       │
│ • Necesitas configurar costos por segmento flexible                │
│ • Quieres combinar múltiples tramos dinámicamente                  │
│ • Necesitas diferenciar entre peso (kg) y volumen (m³)            │
│ • Cada segmento puede usar diferente transporte                    │
│                                                                     │
│ Ejemplo de uso:                                                     │
│   → Módulo de Logística Global (AdminGlobalLogisticsPage)         │
│   → Cálculos dinámicos seller cart                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ SHIPPING_TIERS (Tipos de envío simple)                             │
├─────────────────────────────────────────────────────────────────────┤
│ Úsalo cuando:                                                       │
│ • Ofreces opciones simples al cliente (Standard vs Express)       │
│ • Los costos son fijos por tier                                    │
│ • Solo necesitas peso (no volumen)                                │
│ • Toda la ruta usa el mismo tipo de transporte                    │
│                                                                     │
│ Ejemplo de uso:                                                     │
│   → Checkout B2C (el cliente elige Standard o Express)            │
│   → Precios fijos por tier                                        │
└─────────────────────────────────────────────────────────────────────┘
*/

-- ============================================================================
-- ⚙️ AGREGAR TRANSPORT_TYPE A SHIPPING_TIERS (OPCIONAL)
-- ============================================================================

-- Si quieres que shipping_tiers también tenga transport_type:
-- (Similar a lo que hicimos con route_logistics_costs)

/*
ALTER TABLE public.shipping_tiers
ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20) NOT NULL DEFAULT 'aereo'
CHECK (transport_type IN ('maritimo', 'aereo', 'terrestre'));

-- Actualizar tiers existentes según su tipo
UPDATE public.shipping_tiers
SET transport_type = CASE
  WHEN tier_type = 'standard' THEN 'maritimo'
  WHEN tier_type = 'express' THEN 'aereo'
  ELSE 'aereo'
END;
*/
