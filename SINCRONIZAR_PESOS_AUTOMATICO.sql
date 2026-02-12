-- =============================================================================
-- SINCRONIZACIÓN AUTOMÁTICA DE PESOS - Para nuevos productos y actualizaciones
-- Fecha: 2026-02-12
-- Propósito: Mantener peso_kg y peso_g sincronizados automáticamente
-- =============================================================================

-- 1. SINCRONIZAR TODOS los productos existentes (incluye nuevos)
UPDATE products
SET
  -- Si tiene peso_kg pero no peso_g, calcular peso_g
  peso_g = CASE 
    WHEN peso_g IS NULL OR peso_g = 0 THEN 
      COALESCE(NULLIF(peso_kg, 0) * 1000.0, NULLIF(weight_kg, 0) * 1000.0, NULLIF(weight_g, 0), 0)
    ELSE peso_g
  END,
  
  -- Si tiene peso_g pero no peso_kg, calcular peso_kg
  peso_kg = CASE 
    WHEN peso_kg IS NULL OR peso_kg = 0 THEN 
      COALESCE(NULLIF(peso_g, 0) / 1000.0, NULLIF(weight_g, 0) / 1000.0, NULLIF(weight_kg, 0), 0)
    ELSE peso_kg
  END,
  
  updated_at = NOW()
WHERE 
  -- Solo actualizar donde hay datos de peso pero no están sincronizados
  (peso_kg IS NULL OR peso_kg = 0 OR peso_g IS NULL OR peso_g = 0)
  AND (
    peso_kg > 0 OR peso_g > 0 OR 
    weight_kg > 0 OR weight_g > 0
  );

-- 2. VERIFICAR productos con peso que salen NULL en la vista
WITH productos_con_peso AS (
  SELECT 
    p.id,
    p.nombre,
    p.sku_interno,
    p.peso_kg,
    p.peso_g,
    p.is_active,
    COALESCE(p.peso_kg, p.peso_g / 1000.0, 0) as peso_calculado
  FROM products p
  WHERE (p.peso_kg > 0 OR p.peso_g > 0)
)
SELECT 
  pcp.nombre,
  pcp.sku_interno,
  pcp.peso_kg || ' kg' as peso_kg,
  pcp.peso_g || ' g' as peso_g,
  pcp.peso_calculado || ' kg' as peso_calculado,
  COALESCE(vpsc.total_cost, 0) as costo_logistica,
  CASE 
    WHEN NOT pcp.is_active THEN 'Producto inactivo'
    WHEN vpsc.total_cost IS NULL THEN 'NULL - No aparece en vista'
    WHEN vpsc.total_cost = 0 THEN 'CERO - Sin costo calculado'
    ELSE 'OK'
  END as estado
FROM productos_con_peso pcp
LEFT JOIN v_product_shipping_costs vpsc ON vpsc.product_id = pcp.id
WHERE vpsc.total_cost IS NULL OR vpsc.total_cost = 0
ORDER BY pcp.nombre
LIMIT 20;

-- 3. ESTADÍSTICAS después de sincronización
SELECT 
  COUNT(*) as total_productos,
  COUNT(CASE WHEN peso_kg > 0 THEN 1 END) as con_peso_kg,
  COUNT(CASE WHEN peso_g > 0 THEN 1 END) as con_peso_g,
  COUNT(CASE WHEN peso_kg > 0 AND peso_g > 0 THEN 1 END) as ambos_sincronizados,
  COUNT(CASE WHEN (peso_kg > 0 OR peso_g > 0) AND is_active = TRUE THEN 1 END) as activos_con_peso
FROM products;

-- 4. PRODUCTOS ACTUALIZADOS recientemente (últimos con peso)
SELECT 
  p.nombre,
  p.sku_interno,
  p.peso_kg || ' kg' as peso_kg,
  p.peso_g || ' g' as peso_g,
  vpsc.total_cost as costo_logistica,
  p.updated_at as ultima_actualizacion
FROM products p
LEFT JOIN v_product_shipping_costs vpsc ON vpsc.product_id = p.id
WHERE (p.peso_kg > 0 OR p.peso_g > 0)
ORDER BY p.updated_at DESC
LIMIT 10;

-- =============================================================================
-- RESULTADO ESPERADO:
-- Query 1: UPDATE mostrará cuántos productos fueron sincronizados
-- Query 2: Lista de productos con peso pero costo NULL (para investigar)
-- Query 3: Estadísticas generales de sincronización
-- Query 4: Últimos 10 productos actualizados con sus costos
-- =============================================================================

-- =============================================================================
-- INSTRUCCIONES DE USO:
-- Ejecutar este script cada vez que:
-- 1. Se agregue peso a un producto nuevo
-- 2. Se actualice el peso de un producto existente
-- 3. Un producto muestre NULL en costo de logística
-- 
-- Comando: \i SINCRONIZAR_PESOS_AUTOMATICO.sql
-- =============================================================================
