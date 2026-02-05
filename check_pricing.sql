-- Consulta para verificar productos con precio B2B de $16.67
SELECT 
  p.id,
  p.sku_interno,
  p.nombre,
  p.costo_base_excel,
  p.precio_mayorista_base,
  vp.precio_b2b,
  vp.margin_value,
  vp.platform_fee,
  -- Verificar cálculo manual
  ROUND((p.costo_base_excel * 0.30)::numeric, 2) AS margen_calculado_30pct,
  ROUND(((p.costo_base_excel + (p.costo_base_excel * 0.30)) * 0.12)::numeric, 2) AS fee_calculado,
  ROUND((p.costo_base_excel + (p.costo_base_excel * 0.30) + ((p.costo_base_excel + (p.costo_base_excel * 0.30)) * 0.12))::numeric, 2) AS total_calculado
FROM products p
LEFT JOIN v_productos_con_precio_b2b vp ON vp.id = p.id
WHERE vp.precio_b2b BETWEEN 16.60 AND 16.70
  AND p.is_active = true
ORDER BY vp.precio_b2b DESC
LIMIT 5;

-- También ver producto con costo base ~0.88
SELECT 
  p.id,
  p.sku_interno,
  p.nombre,
  p.costo_base_excel,
  p.precio_mayorista_base,
  vp.precio_b2b,
  vp.margin_value,
  vp.platform_fee
FROM products p
LEFT JOIN v_productos_con_precio_b2b vp ON vp.id = p.id
WHERE p.costo_base_excel BETWEEN 0.85 AND 0.91
  AND p.is_active = true
ORDER BY p.costo_base_excel
LIMIT 10;
