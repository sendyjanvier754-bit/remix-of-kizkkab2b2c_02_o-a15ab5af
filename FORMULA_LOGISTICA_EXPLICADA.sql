-- =============================================================================
-- FÓRMULA DE CÁLCULO DE LOGÍSTICA - EXPLICACIÓN COMPLETA
-- Fecha: 2026-02-12
-- =============================================================================

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║                    FÓRMULA DE COSTO DE LOGÍSTICA                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

FUNCIÓN: calculate_shipping_cost(route_id, peso_kg, is_oversize, dimensiones)

┌─────────────────────────────────────────────────────────────────────────┐
│ PASO 1: CÁLCULO DEL COSTO BASE                                          │
└─────────────────────────────────────────────────────────────────────────┘

Se divide en 2 tramos:

  Tramo A: China → Tránsito (Miami)
  • Tarifa: $3.50 por kg (por defecto)
  • Cálculo: peso_kg × 3.50

  Tramo B: Tránsito (Miami) → Haití
  • Tarifa: $5.00 por kg (por defecto)
  • Conversión: Se usa libras (1 kg = 2.20462 lbs)
  • Cálculo: peso_kg × 2.20462 × 5.00

  COSTO BASE = (peso_kg × 3.50) + (peso_kg × 2.20462 × 5.00)

┌─────────────────────────────────────────────────────────────────────────┐
│ EJEMPLO: Producto de 0.6 kg (600 gramos)                                │
└─────────────────────────────────────────────────────────────────────────┘

  Tramo A: 0.6 × 3.50 = $2.10
  Tramo B: 0.6 × 2.20462 × 5.00 = 0.6 × 11.0231 = $6.61
  
  COSTO BASE = $2.10 + $6.61 = $8.71

┌─────────────────────────────────────────────────────────────────────────┐
│ PASO 2: SURCHARGE POR OVERSIZE (Opcional)                               │
└─────────────────────────────────────────────────────────────────────────┘

  SI is_oversize = TRUE:
    • Recargo: 15% del costo base
    • Cálculo: costo_base × 0.15
  
  Ejemplo con 0.6 kg oversize:
    • Recargo: $8.71 × 0.15 = $1.31
    • Subtotal: $8.71 + $1.31 = $10.02

┌─────────────────────────────────────────────────────────────────────────┐
│ PASO 3: SURCHARGE POR DIMENSIONES (Opcional)                            │
└─────────────────────────────────────────────────────────────────────────┘

  SI volumen > 0.15 m³:
    • Volumen = (largo_cm × ancho_cm × alto_cm) / 1,000,000
    • Recargo: 10% del costo base
    • Cálculo: costo_base × 0.10
  
  Ejemplo con volumen de 0.20 m³:
    • Recargo: $8.71 × 0.10 = $0.87
    • Subtotal: $8.71 + $0.87 = $9.58

┌─────────────────────────────────────────────────────────────────────────┐
│ PASO 4: COSTO TOTAL                                                     │
└─────────────────────────────────────────────────────────────────────────┘

  COSTO TOTAL = costo_base + oversize_surcharge + dimensional_surcharge

╔═══════════════════════════════════════════════════════════════════════════╗
║                      TABLA DE COSTOS POR PESO                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
*/

-- Calcular costos para diferentes pesos (SIN surcharges)
SELECT 
  peso_kg || ' kg' as peso,
  ROUND((peso_kg * 3.50)::NUMERIC, 2) as tramo_a,
  ROUND((peso_kg * 2.20462 * 5.00)::NUMERIC, 2) as tramo_b,
  ROUND((peso_kg * 3.50 + peso_kg * 2.20462 * 5.00)::NUMERIC, 2) as costo_total
FROM (
  VALUES 
    (0.1),
    (0.3),
    (0.5),
    (0.6),
    (1.0),
    (1.5),
    (2.0),
    (3.0),
    (5.0)
) AS pesos(peso_kg)
ORDER BY peso_kg;

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║                         COSTOS ESPERADOS                                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

  0.1 kg → $1.45
  0.3 kg → $4.36
  0.5 kg → $7.26
  0.6 kg → $8.71  ← TU CASO
  1.0 kg → $14.52
  1.5 kg → $21.78
  2.0 kg → $29.04
  3.0 kg → $43.57
  5.0 kg → $72.62

╔═══════════════════════════════════════════════════════════════════════════╗
║                      NOTAS IMPORTANTES                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝

1. El costo es PROPORCIONAL al peso (no se redondea al kg completo)
2. Para 300g (0.3 kg) = $4.36, para 600g (0.6 kg) = $8.71
3. Los costos se calculan en tiempo real desde route_logistics_costs
4. Si no hay datos en route_logistics_costs, usa valores por defecto:
   - Tramo A: $3.50/kg
   - Tramo B: $5.00/kg (en libras)

╔═══════════════════════════════════════════════════════════════════════════╗
║                    VERIFICACIÓN EN LA VISTA                               ║
╚═══════════════════════════════════════════════════════════════════════════╝
*/

-- Ver productos reales con sus costos calculados
SELECT 
  product_name,
  sku,
  weight_kg || ' kg' as peso,
  base_cost as costo_base,
  oversize_surcharge as recargo_oversize,
  dimensional_surcharge as recargo_dimensional,
  total_cost as costo_total,
  CASE 
    WHEN oversize_surcharge > 0 THEN 'CON recargo oversize'
    WHEN dimensional_surcharge > 0 THEN 'CON recargo dimensional'
    ELSE 'Sin recargos'
  END as tipo
FROM v_product_shipping_costs
WHERE total_cost > 0
ORDER BY weight_kg
LIMIT 10;
