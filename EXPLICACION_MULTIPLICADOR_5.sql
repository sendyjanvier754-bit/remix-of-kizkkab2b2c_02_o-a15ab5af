-- =============================================================================
-- EXPLICACIÓN: ¿Por qué × 5.00 en el Tramo B?
-- Fecha: 2026-02-12
-- =============================================================================

/*
PREGUNTA:
=========
En el cálculo:
  Tramo B: 2 kg × 2.20462 lb/kg × 5.00 HTG/lb = 22.05 HTG
  
¿De dónde viene el "× 5.00"?


RESPUESTA:
==========
El 5.00 es el COSTO POR LIBRA configurado en route_logistics_costs para el Tramo B.

El Tramo B cobra por LIBRAS (lb), no por kilogramos.


DESGLOSE DEL CÁLCULO:
=====================

┌─────────────────────────────────────────────────────────────┐
│ TRAMO A: China → Hub de Tránsito                           │
│ ─────────────────────────────────                          │
│ • Cobra por: KILOGRAMOS (kg)                               │
│ • Tarifa: 3.50 USD/kg (o HTG/kg según configuración)      │
│ • Cálculo: peso_kg × 3.50                                  │
│ • Ejemplo: 2 kg × 3.50 = 7.00                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TRAMO B: Hub de Tránsito → Haití                          │
│ ─────────────────────────────────                          │
│ • Cobra por: LIBRAS (lb) ⚠️ Diferente unidad             │
│ • Tarifa: 5.00 USD/lb (o HTG/lb según configuración)      │
│ • Conversión: 1 kg = 2.20462 lb                           │
│ • Cálculo: peso_kg × 2.20462 × 5.00                       │
│ • Ejemplo: 2 kg × 2.20462 lb/kg × 5.00 = 22.05           │
└─────────────────────────────────────────────────────────────┘


ORIGEN DE LOS VALORES:
======================

Archivo: MIGRACION_CORREGIDA_MISMO_ORIGEN_DATOS.sql
Líneas 167-178:

  -- Obtener costos del tramo A
  SELECT cost_per_kg INTO v_tramo_a_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'china_to_transit'
  LIMIT 1;

  -- Obtener costos del tramo B
  SELECT cost_per_kg INTO v_tramo_b_cost
  FROM public.route_logistics_costs
  WHERE shipping_route_id = p_route_id 
    AND segment = 'transit_to_destination'
  LIMIT 1;

  -- Usar valores por defecto si no existen
  v_tramo_a_cost := COALESCE(v_tramo_a_cost, 3.50);
  v_tramo_b_cost := COALESCE(v_tramo_b_cost, 5.00);  ← AQUÍ ESTÁ EL 5.00


VALORES POR DEFECTO:
====================
Si no hay datos en route_logistics_costs, la función usa:
  • v_tramo_a_cost = 3.50 (por defecto)
  • v_tramo_b_cost = 5.00 (por defecto)


¿POR QUÉ DIFERENTE UNIDAD?
===========================
El Tramo B (hacia Haití) probablemente utiliza transportadoras que cobran 
en libras porque:
  1. Sistema de medida común en logística de USA/Caribe
  2. El hub de tránsito puede estar en USA (Miami, NY, etc.)
  3. Los carriers locales cobran en lb, no en kg


CONVERSIÓN KG → LB:
===================
1 kilogramo = 2.20462 libras

Entonces:
  2 kg × 2.20462 = 4.40924 lb
  4.40924 lb × 5.00 USD/lb = 22.0462 USD
  Redondeado: 22.05 USD


FÓRMULA COMPLETA:
=================
  COSTO TOTAL = (peso_kg × tramo_a_cost) + (peso_kg × 2.20462 × tramo_b_cost)
  
  Para 2 kg:
    = (2 × 3.50) + (2 × 2.20462 × 5.00)
    = 7.00 + 22.05
    = 29.05 USD (o HTG según configuración)
*/

-- =============================================================================
-- CONSULTA: Ver valores reales en route_logistics_costs
-- =============================================================================

SELECT 
  '🔍 Origen del × 5.00' as info,
  segment as tramo,
  cost_per_kg as tarifa,
  CASE 
    WHEN segment = 'china_to_transit' THEN 'Cobra por KG'
    WHEN segment = 'transit_to_destination' THEN 'Cobra por LB (libras)'
    ELSE 'Otro'
  END as unidad_de_medida,
  CASE 
    WHEN segment = 'china_to_transit' THEN 'peso_kg × ' || cost_per_kg
    WHEN segment = 'transit_to_destination' THEN 'peso_kg × 2.20462 × ' || cost_per_kg
    ELSE ''
  END as formula
FROM route_logistics_costs rlc
JOIN shipping_routes sr ON rlc.shipping_route_id = sr.id
JOIN transit_hubs th ON sr.transit_hub_id = th.id
JOIN destination_countries dc ON sr.destination_country_id = dc.id
WHERE th.code = 'CHINA' 
  AND dc.code = 'HT'
  AND sr.is_active = TRUE
ORDER BY segment;

-- =============================================================================
-- EJEMPLO: Calcular costo para diferentes pesos
-- =============================================================================

WITH pesos AS (
  SELECT peso FROM (VALUES (0.5), (1.0), (2.0), (5.0), (10.0)) AS t(peso)
),
tarifas AS (
  SELECT 3.50 as tramo_a, 5.00 as tramo_b  -- Valores por defecto
)
SELECT 
  '📊 Costos por peso' as info,
  p.peso as peso_kg,
  ROUND((p.peso * t.tramo_a)::numeric, 2) as tramo_a_costo,
  ROUND((p.peso * 2.20462 * t.tramo_b)::numeric, 2) as tramo_b_costo,
  ROUND(((p.peso * t.tramo_a) + (p.peso * 2.20462 * t.tramo_b))::numeric, 2) as total
FROM pesos p, tarifas t
ORDER BY p.peso;

-- =============================================================================
-- VERIFICAR: ¿Los costos están realmente en USD o HTG?
-- =============================================================================

/*
Si los valores son:
  • Tramo A = 3.50 → Probablemente USD
  • Tramo B = 5.00 → Probablemente USD

Si los valores son:
  • Tramo A = 490.00 → Probablemente HTG
  • Tramo B = 700.00 → Probablemente HTG

COSTO TOTAL PARA 2 KG:
  • En USD: ~$29.05 USD (razonable para envío internacional)
  • En HTG: ~29.05 HTG ≈ $0.21 USD (demasiado barato, probablemente error)

CONCLUSIÓN: Si el resultado es 29.05, los costos están en USD, NO en HTG.
*/

SELECT 
  '✅ Verificación de moneda' as resultado,
  'Si costo total = 29.05 para 2 kg' as observacion,
  'Los costos están en USD, no HTG' as conclusion,
  'Etiquetas HTG en código son incorrectas' as nota;

-- =============================================================================
-- ACCIÓN REQUERIDA: Actualizar etiquetas en código y documentación
-- =============================================================================

/*
PROBLEMA IDENTIFICADO:
  • Los costos SÍ están en USD
  • Las etiquetas en el código dicen "HTG"
  • Esto causa confusión

SOLUCIÓN:
  • Cambiar todas las etiquetas de "htg" a "usd" en los scripts
  • Actualizar comentarios en funciones
  • Documentar que los costos están en USD
  
NO necesitas cambiar los valores en la base de datos, 
solo las etiquetas en el código.
*/
