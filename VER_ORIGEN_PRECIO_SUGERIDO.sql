-- =============================================================================
-- VERIFICACIÓN: De dónde salen los PRECIOS SUGERIDOS DE VENTA
-- Fecha: 2026-02-12
-- =============================================================================

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║           JERARQUÍA DE CÁLCULO DEL PRECIO SUGERIDO DE VENTA              ║
╚═══════════════════════════════════════════════════════════════════════════╝

FUNCIÓN: calculate_suggested_pvp(product_id)

La función sigue esta jerarquía (en orden de prioridad):

  ┌─────────────────────────────────────────────────────────────────────┐
  │ PRIORIDAD 1: Precio configurado MANUALMENTE por ADMIN              │
  │ Campo: products.precio_sugerido_venta                               │
  │ Si existe y es > 0 → USA ESTE PRECIO                                │
  └─────────────────────────────────────────────────────────────────────┘
         ↓ (si no existe)
  ┌─────────────────────────────────────────────────────────────────────┐
  │ PRIORIDAD 2: Precio MÁXIMO del MERCADO (otros sellers)             │
  │ Vista: v_product_max_pvp                                            │
  │ Si existe y es > precio_b2b → USA ESTE PRECIO                       │
  │ Competitivo: usa el precio más alto que otros sellers están usando │
  └─────────────────────────────────────────────────────────────────────┘
         ↓ (si no existe)
  ┌─────────────────────────────────────────────────────────────────────┐
  │ PRIORIDAD 3: MARKUP DE CATEGORÍA                                    │
  │ Campo: categories.default_markup_multiplier                         │
  │ Fórmula: precio_b2b × markup_categoria                              │
  │ Ejemplo: Si markup = 4.0 → precio_b2b × 4.0                         │
  └─────────────────────────────────────────────────────────────────────┘
         ↓ (si no existe)
  ┌─────────────────────────────────────────────────────────────────────┐
  │ PRIORIDAD 4: MARKUP POR DEFECTO (FALLBACK)                          │
  │ Fórmula: precio_b2b × 4.0                                           │
  │ Margen: 300% sobre precio_b2b                                       │
  └─────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║                           ¿QUÉ ES precio_b2b?                             ║
╚═══════════════════════════════════════════════════════════════════════════╝

Vista: v_productos_con_precio_b2b
Función: calculate_base_price_only(product_id, margin_percent)

Fórmula: precio_b2b = (costo_base × (1 + margen%)) + platform_fee

Donde:
  • costo_base: products.costo_base_excel
  • margen: 300% (margen por defecto)
  • platform_fee: 12% de (costo_base × (1 + margen%))

Ejemplo con costo_base = $0.88:
  1. Costo con margen: $0.88 × 4.0 = $3.52
  2. Platform fee: $3.52 × 0.12 = $0.42
  3. precio_b2b = $3.52 + $0.42 = $3.94

╔═══════════════════════════════════════════════════════════════════════════╗
║                       DESGLOSE COMPLETO DE PRECIOS                        ║
╚═══════════════════════════════════════════════════════════════════════════╝
*/

-- 1. Ver precios sugeridos con su origen (jerarquía)
SELECT 
  p.sku_interno,
  p.nombre,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  ROUND(p.precio_sugerido_venta, 2) as admin_configuro,
  ROUND(vm.max_pvp, 2) as mercado_max_pvp,
  c.default_markup_multiplier as markup_categoria,
  ROUND(public.calculate_suggested_pvp(p.id, NULL), 2) as pvp_sugerido_calculado,
  CASE 
    WHEN p.precio_sugerido_venta IS NOT NULL AND p.precio_sugerido_venta > 0 
      THEN '1. ADMIN configuró manualmente'
    WHEN vm.max_pvp IS NOT NULL AND vm.max_pvp > vb2b.precio_b2b 
      THEN '2. Mercado (MAX PVP de otros sellers)'
    WHEN c.default_markup_multiplier IS NOT NULL AND c.default_markup_multiplier > 0 
      THEN '3. Markup de categoría (' || c.default_markup_multiplier || 'x)'
    ELSE '4. Markup por defecto (4.0x)'
  END as origen_precio,
  ROUND(((public.calculate_suggested_pvp(p.id, NULL) - vb2b.precio_b2b) / NULLIF(vb2b.precio_b2b, 0) * 100)::numeric, 0) || '%' as margen_sobre_b2b
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
LEFT JOIN v_product_max_pvp vm ON vm.product_id = p.id
LEFT JOIN categories c ON c.id = p.categoria_id
WHERE p.is_active = TRUE
  AND vb2b.precio_b2b > 0
ORDER BY p.updated_at DESC
LIMIT 15;

-- 2. Ver desglose del precio_b2b (cómo se calcula)
SELECT 
  p.sku_interno,
  p.nombre,
  ROUND(p.costo_base_excel, 2) as costo_base,
  ROUND((p.costo_base_excel * 4.0)::numeric, 2) as costo_con_margen_300,
  ROUND(((p.costo_base_excel * 4.0) * 0.12)::numeric, 2) as platform_fee_12,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b_final,
  vb2b.applied_margin_percent as margen_aplicado
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
WHERE p.is_active = TRUE
  AND p.costo_base_excel > 0
ORDER BY p.updated_at DESC
LIMIT 10;

-- 3. Ver productos con precio sugerido MANUAL (Prioridad 1)
SELECT 
  p.sku_interno,
  p.nombre,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  ROUND(p.precio_sugerido_venta, 2) as precio_sugerido_manual,
  ROUND(((p.precio_sugerido_venta - vb2b.precio_b2b) / vb2b.precio_b2b * 100)::numeric, 0) || '%' as markup_manual,
  '1. ADMIN (Manual)' as origen
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
WHERE p.is_active = TRUE
  AND p.precio_sugerido_venta IS NOT NULL
  AND p.precio_sugerido_venta > 0
ORDER BY p.updated_at DESC
LIMIT 10;

-- 4. Ver productos con precios de MERCADO (Prioridad 2)
SELECT 
  p.sku_interno,
  p.nombre,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  ROUND(vm.max_pvp, 2) as mercado_max_pvp,
  ROUND(vm.min_pvp, 2) as mercado_min_pvp,
  ROUND(vm.avg_pvp, 2) as mercado_avg_pvp,
  vm.seller_count as total_sellers,
  '2. Mercado (competitivo)' as origen
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
JOIN v_product_max_pvp vm ON vm.product_id = p.id
WHERE p.is_active = TRUE
  AND (p.precio_sugerido_venta IS NULL OR p.precio_sugerido_venta = 0)
  AND vm.max_pvp > vb2b.precio_b2b
ORDER BY vm.seller_count DESC
LIMIT 10;

-- 5. Ver productos con MARKUP de CATEGORÍA (Prioridad 3)
SELECT 
  c.name as categoria,
  c.default_markup_multiplier as markup,
  COUNT(*) as total_productos,
  ROUND(AVG(vb2b.precio_b2b)::numeric, 2) as avg_precio_b2b,
  ROUND(AVG(vb2b.precio_b2b * c.default_markup_multiplier)::numeric, 2) as avg_pvp_sugerido
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
JOIN categories c ON c.id = p.categoria_id
WHERE p.is_active = TRUE
  AND c.default_markup_multiplier IS NOT NULL
  AND c.default_markup_multiplier > 0
GROUP BY c.name, c.default_markup_multiplier
ORDER BY c.name;

-- 6. Ver productos usando FALLBACK (Prioridad 4)
SELECT 
  p.sku_interno,
  p.nombre,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  ROUND((vb2b.precio_b2b * 4.0)::numeric, 2) as pvp_sugerido_fallback,
  '4. Fallback (4.0x)' as origen,
  '300% margen' as nota
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
LEFT JOIN v_product_max_pvp vm ON vm.product_id = p.id
LEFT JOIN categories c ON c.id = p.categoria_id
WHERE p.is_active = TRUE
  AND (p.precio_sugerido_venta IS NULL OR p.precio_sugerido_venta = 0)
  AND (vm.max_pvp IS NULL OR vm.max_pvp <= vb2b.precio_b2b)
  AND (c.default_markup_multiplier IS NULL OR c.default_markup_multiplier = 0)
ORDER BY vb2b.precio_b2b DESC
LIMIT 10;

-- =============================================================================
-- RESULTADO ESPERADO:
-- Query 1: Lista de productos con su PVP sugerido y ORIGEN (de dónde viene)
-- Query 2: Desglose de cómo se calcula el precio_b2b base
-- Query 3: Productos con precio sugerido MANUAL (admin configuró)
-- Query 4: Productos usando precio del MERCADO (otros sellers)
-- Query 5: Productos usando MARKUP de categoría
-- Query 6: Productos usando FALLBACK (4.0x por defecto)
-- =============================================================================
