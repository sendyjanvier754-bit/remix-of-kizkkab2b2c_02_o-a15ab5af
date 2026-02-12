-- =============================================================================
-- GUÍA DE EJECUCIÓN: Sincronización de peso y corrección de logística
-- Fecha: 2026-02-12
-- =============================================================================

/*
PROBLEMA IDENTIFICADO:
- Los productos tienen peso_g = 600 pero weight_g = 0.00
- Hay 4 columnas duplicadas: weight_kg, peso_kg, weight_g, peso_g
- La vista calculaba peso = 0 porque weight_g = 0 se evaluaba primero
- Resultado: Logística mostraba $0.00 en el catálogo

SOLUCIÓN:
1. Sincronizar todas las columnas de peso (g ↔ kg)
2. Usar solo peso_kg y peso_g en la vista
3. Opcionalmente eliminar weight_kg y weight_g si no se usan

ORDEN DE EJECUCIÓN:
*/

-- =============================================================================
-- PASO 1: SINCRONIZAR COLUMNAS DE PESO
-- Archivo: SINCRONIZAR_PESO_PRODUCTOS.sql
-- =============================================================================

/*
Este script:
- Hace diagnostico de las columnas de peso
- Convierte peso_g a peso_kg y viceversa
- Copia datos de weight_* a peso_* si estan vacios
- Analiza si weight_kg y weight_g pueden eliminarse
- Crea backup antes de modificar

EJECUTAR:
*/

\i SINCRONIZAR_PESO_PRODUCTOS.sql

-- =============================================================================
-- PASO 2: ACTUALIZAR LA VISTA v_product_shipping_costs
-- Archivo: FIX_VISTA_SHIPPING_PESO.sql
-- =============================================================================

/*
Este script:
- Recrea la vista usando solo peso_kg y peso_g
- Simplifica la logica (ya no necesita NULLIF)
- Verifica que los productos problematicos tengan costo
- Muestra todos los productos con logistica calculada

EJECUTAR:
*/

\i FIX_VISTA_SHIPPING_PESO.sql

-- O ejecutar el archivo completo actualizado:
\i VISTAS_FUNCIONES_SHIPPING_CORREGIDA.sql

-- =============================================================================
-- PASO 3: VERIFICAR EN EL FRONTEND
-- =============================================================================

/*
1. Ir al modulo "Mi Catalogo"
2. Abrir la consola del navegador (F12)
3. Buscar estos mensajes:
   Fetching shipping costs for products: [...]
   Shipping data received: [...]
   Shipping costs mapped: {...}
   [Producto]: source_id=..., historico=..., calculado=...

4. La columna "Logistica" ahora debe mostrar valores > $0.00

5. Ejemplo esperado:
   - Camiseta: $X.XX (antes: $0.00)
   - Tanga: $X.XX (antes: $0.00)
   - Zapatillas: $X.XX (antes: $0.00)
*/

-- =============================================================================
-- PASO 4 (OPCIONAL): ELIMINAR COLUMNAS DUPLICADAS
-- =============================================================================

/*
SOLO ejecutar si el analisis del Paso 6 de SINCRONIZAR_PESO_PRODUCTOS.sql
muestra: "SEGURO: Podemos eliminar weight_kg y weight_g"

Descomentar y ejecutar:
*/

-- ALTER TABLE products DROP COLUMN IF EXISTS weight_kg;
-- ALTER TABLE products DROP COLUMN IF EXISTS weight_g;

-- Verificar que solo quedan peso_kg y peso_g:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND (column_name LIKE '%weight%' OR column_name LIKE '%peso%')
ORDER BY column_name;

-- =============================================================================
-- RESUMEN DE CAMBIOS
-- =============================================================================

SELECT 
  'ANTES: weight_g=0, peso_g=600 -> vista calculaba peso=0 -> logistica=$0.00' as problema_original,
  'AHORA: peso_kg y peso_g sincronizados -> vista usa peso correcto -> logistica>$0' as solucion_aplicada,
  'Columnas usadas: peso_kg (kilogramos) y peso_g (gramos)' as columnas_finales,
  'Columnas a eliminar: weight_kg, weight_g (verificar antes)' as limpieza_pendiente;

-- =============================================================================
-- COMANDOS RÁPIDOS DE VERIFICACIÓN
-- =============================================================================

-- Ver productos con peso sincronizado
SELECT 
  id, nombre, sku_interno,
  peso_kg as kg,
  peso_g as gramos,
  ROUND(peso_g / 1000.0, 3) as g_convertido_a_kg,
  ABS(peso_kg - (peso_g / 1000.0)) < 0.01 as sincronizado
FROM products
WHERE is_active = TRUE
AND (peso_kg > 0 OR peso_g > 0)
LIMIT 10;

-- Ver logística calculada desde la vista
SELECT 
  product_id, product_name, sku,
  weight_kg as peso_usado_kg,
  total_cost as logistica_calculada
FROM v_product_shipping_costs
WHERE sku IN ('924221472', '2962434831', '758788899')
ORDER BY sku;

-- Ver catálogo del seller con logística
SELECT 
  sc.nombre,
  sc.sku,
  vpsc.weight_kg as peso_kg,
  vpsc.total_cost as logistica_vista,
  sc.costo_logistica as logistica_historica
FROM seller_catalog sc
LEFT JOIN v_product_shipping_costs vpsc 
  ON vpsc.product_id = sc.source_product_id
WHERE sc.is_active = TRUE
ORDER BY sc.nombre
LIMIT 10;
