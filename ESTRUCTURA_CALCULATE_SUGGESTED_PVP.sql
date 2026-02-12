-- =============================================================================
-- ESTRUCTURA DE LA FUNCIÓN: calculate_suggested_pvp(product_id)
-- Archivo: supabase/migrations/20260204_suggested_pvp_function.sql
-- =============================================================================

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║           FUNCIÓN: calculate_suggested_pvp(product_id, market_id)         ║
╚═══════════════════════════════════════════════════════════════════════════╝

📝 DEFINICIÓN:
   CREATE OR REPLACE FUNCTION calculate_suggested_pvp(
     p_product_id UUID,
     p_market_id UUID DEFAULT NULL  -- No se usa actualmente
   )
   RETURNS NUMERIC

🎯 PROPÓSITO:
   Calcular el precio de venta al público (PVP) sugerido para que un seller
   sepa a qué precio debería vender un producto en su tienda B2C.

╔═══════════════════════════════════════════════════════════════════════════╗
║                      LÓGICA DE PRIORIDAD (4 NIVELES)                      ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────┐
│ PRIORIDAD 1: PRECIO CONFIGURADO MANUALMENTE POR ADMIN                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Campo: products.precio_sugerido_venta                                   │
│ Lógica:                                                                 │
│   SELECT precio_sugerido_venta                                          │
│   FROM products                                                         │
│   WHERE id = p_product_id;                                              │
│                                                                         │
│ Retorna SI:                                                             │
│   - precio_sugerido_venta IS NOT NULL                                   │
│   - precio_sugerido_venta > 0                                           │
│                                                                         │
│ Ejemplo:                                                                │
│   Admin configuró: $25.99                                               │
│   → RETORNA: $25.99                                                     │
└─────────────────────────────────────────────────────────────────────────┘
         ↓ (si no existe o es 0)

┌─────────────────────────────────────────────────────────────────────────┐
│ PRIORIDAD 2: PRECIO MÁXIMO DEL MERCADO (OTROS SELLERS)                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Vista: v_product_max_pvp                                                │
│ Lógica:                                                                 │
│   SELECT max_pvp                                                        │
│   FROM v_product_max_pvp                                                │
│   WHERE product_id = p_product_id;                                      │
│                                                                         │
│ Retorna SI:                                                             │
│   - max_pvp IS NOT NULL                                                 │
│   - max_pvp > 0                                                         │
│                                                                         │
│ Ejemplo:                                                                │
│   Seller A vende a: $22.50                                              │
│   Seller B vende a: $24.00 ← MAX                                        │
│   Seller C vende a: $21.99                                              │
│   → RETORNA: $24.00                                                     │
│                                                                         │
│ Estrategia: Competitivo (usa el precio más alto del mercado)           │
└─────────────────────────────────────────────────────────────────────────┘
         ↓ (si no hay otros sellers)

┌─────────────────────────────────────────────────────────────────────────┐
│ PRIORIDAD 3: MARKUP DE CATEGORÍA                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Tablas: v_productos_con_precio_b2b + categories                        │
│ Lógica:                                                                 │
│   SELECT vp.precio_b2b, c.default_markup_multiplier                    │
│   FROM v_productos_con_precio_b2b vp                                   │
│   JOIN products p ON p.id = vp.id                                      │
│   LEFT JOIN categories c ON c.id = p.categoria_id                      │
│   WHERE vp.id = p_product_id;                                          │
│                                                                         │
│ Cálculo:                                                                │
│   pvp_sugerido = precio_b2b × default_markup_multiplier                │
│                                                                         │
│ Retorna SI:                                                             │
│   - precio_b2b IS NOT NULL AND precio_b2b > 0                          │
│   - default_markup_multiplier IS NOT NULL AND > 0                      │
│                                                                         │
│ Ejemplo:                                                                │
│   precio_b2b = $5.00                                                    │
│   markup_categoria = 3.5                                                │
│   → RETORNA: $5.00 × 3.5 = $17.50                                      │
└─────────────────────────────────────────────────────────────────────────┘
         ↓ (si no hay markup de categoría)

┌─────────────────────────────────────────────────────────────────────────┐
│ PRIORIDAD 4: MARKUP POR DEFECTO (FALLBACK)                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Multiplicador: 4.0 (fijo, hardcoded)                                   │
│ Lógica:                                                                 │
│   pvp_sugerido = precio_b2b × 4.0                                       │
│                                                                         │
│ Retorna SI:                                                             │
│   - precio_b2b IS NOT NULL AND precio_b2b > 0                          │
│   - No hay markup de categoría                                          │
│                                                                         │
│ Ejemplo:                                                                │
│   precio_b2b = $5.00                                                    │
│   → RETORNA: $5.00 × 4.0 = $20.00                                      │
│                                                                         │
│ Margen: 300% sobre el precio B2B                                        │
└─────────────────────────────────────────────────────────────────────────┘
         ↓ (si tampoco hay precio_b2b)

┌─────────────────────────────────────────────────────────────────────────┐
│ FALLBACK FINAL: RETORNA 0                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Si no hay datos suficientes para calcular, retorna 0                   │
└─────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║                         VARIABLES DECLARADAS                              ║
╚═══════════════════════════════════════════════════════════════════════════╝

DECLARE
  v_precio_sugerido NUMERIC;      -- Precio configurado por admin
  v_precio_b2b NUMERIC;            -- Precio B2B del producto
  v_max_pvp NUMERIC;               -- Precio máximo de otros sellers
  v_markup_multiplier NUMERIC;     -- Multiplicador de categoría
  v_calculated_pvp NUMERIC;        -- Precio calculado

╔═══════════════════════════════════════════════════════════════════════════╗
║                          MANEJO DE ERRORES                                ║
╚═══════════════════════════════════════════════════════════════════════════╝

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calculando PVP sugerido para producto %: %', 
                  p_product_id, SQLERRM;
    RETURN 0;

Si ocurre cualquier error:
  • Registra un WARNING en los logs de PostgreSQL
  • Retorna 0 (para evitar romper el sistema)

╔═══════════════════════════════════════════════════════════════════════════╗
║                        EJEMPLO DE EJECUCIÓN                               ║
╚═══════════════════════════════════════════════════════════════════════════╝
*/

-- Ejemplo 1: Producto con precio_sugerido_venta configurado
SELECT 
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid as product_id,
  calculate_suggested_pvp('f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, NULL) as pvp_sugerido,
  'Admin configuró el precio' as origen;

-- Ejemplo 2: Producto sin precio admin, con otros sellers
SELECT 
  p.id as product_id,
  p.nombre,
  p.precio_sugerido_venta as admin_config,
  vm.max_pvp as mercado_max,
  calculate_suggested_pvp(p.id, NULL) as pvp_calculado,
  CASE 
    WHEN p.precio_sugerido_venta IS NOT NULL AND p.precio_sugerido_venta > 0 
      THEN '1. Admin'
    WHEN vm.max_pvp IS NOT NULL AND vm.max_pvp > 0 
      THEN '2. Mercado'
    WHEN EXISTS (
      SELECT 1 FROM categories c 
      JOIN products p2 ON p2.categoria_id = c.id 
      WHERE p2.id = p.id 
        AND c.default_markup_multiplier IS NOT NULL 
        AND c.default_markup_multiplier > 0
    ) 
      THEN '3. Markup Categoría'
    ELSE '4. Fallback (4.0x)'
  END as origen_precio
FROM products p
LEFT JOIN v_product_max_pvp vm ON vm.product_id = p.id
WHERE p.is_active = TRUE
LIMIT 5;

-- Ejemplo 3: Desglose completo de un producto
WITH producto_data AS (
  SELECT 
    p.id,
    p.nombre,
    p.precio_sugerido_venta,
    vb2b.precio_b2b,
    vm.max_pvp,
    c.default_markup_multiplier,
    calculate_suggested_pvp(p.id, NULL) as pvp_final
  FROM products p
  LEFT JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
  LEFT JOIN v_product_max_pvp vm ON vm.product_id = p.id
  LEFT JOIN categories c ON c.id = p.categoria_id
  WHERE p.is_active = TRUE
  LIMIT 1
)
SELECT 
  nombre,
  ROUND(precio_sugerido_venta, 2) as "1_admin_config",
  ROUND(max_pvp, 2) as "2_mercado_max",
  ROUND(precio_b2b * COALESCE(default_markup_multiplier, 4.0), 2) as "3_calculado",
  ROUND(pvp_final, 2) as "pvp_final_retornado"
FROM producto_data;

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║                           VENTAJAS DE ESTA LÓGICA                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

✓ Flexibilidad: Admin puede sobrescribir cualquier cálculo automático
✓ Competitivo: Usa precios del mercado cuando están disponibles
✓ Inteligente: Se adapta por categoría de producto
✓ Predecible: Siempre retorna un valor (nunca NULL)
✓ Seguro: Manejo de errores con EXCEPTION
✓ Auditable: Logs con RAISE WARNING

╔═══════════════════════════════════════════════════════════════════════════╗
║                          POSIBLES MEJORAS FUTURAS                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

1. Usar el parámetro p_market_id para calcular precios por mercado/país
2. Considerar estacionalidad (fechas especiales, temporadas)
3. Incluir análisis de competencia por rango de precios
4. Agregar ML para predecir el mejor precio según histórico de ventas
5. Considerar costo de logística en el cálculo
6. Incluir márgenes mínimos requeridos por el sistema

╔═══════════════════════════════════════════════════════════════════════════╗
║                        DÓNDE SE USA ESTA FUNCIÓN                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

1. Vista: v_productos_con_precio_b2b (para mostrar en admin)
2. Hook: useSellerCatalog.ts (obtiene precioSugeridoVenta)
3. Componente: PublicacionDialog.tsx (muestra al seller)
4. RPC: Puede llamarse directamente desde frontend si es necesario
*/
