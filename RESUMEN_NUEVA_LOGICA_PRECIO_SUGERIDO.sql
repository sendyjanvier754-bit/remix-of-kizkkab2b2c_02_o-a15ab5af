-- =============================================================================
-- RESUMEN: NUEVA LÓGICA DE PRECIO SUGERIDO SIMPLIFICADA
-- Fecha: 2026-02-12
-- =============================================================================

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║                    NUEVA LÓGICA SIMPLIFICADA                              ║
╚═══════════════════════════════════════════════════════════════════════════╝

ANTES (Compleja - 4 prioridades):
  1. precio_sugerido_venta del admin
  2. MAX PVP de otros sellers (mercado)
  3. precio_b2b × markup_categoria
  4. precio_b2b × 4.0 (fallback)

AHORA (Optimizada - prioriza markup de categoría):
  1. Calcular: precio_b2b × markup_categoria (o 4.0 por defecto)
  2. Si existe precio B2C Y es MAYOR → usar precio B2C
  3. Caso contrario → usar el calculado

╔═══════════════════════════════════════════════════════════════════════════╗
║                         FLUJO DE CÁLCULO                                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────┐
│ PASO 1: Calcular precio usando multiplicador de categoría               │
├─────────────────────────────────────────────────────────────────────────┤
│ SELECT precio_b2b, c.default_markup_multiplier                         │
│ FROM v_productos_con_precio_b2b                                        │
│ JOIN categories c ON c.id = producto.categoria_id                      │
│                                                                         │
│ Cálculo:                                                                │
│   • SI markup_categoria existe → precio_b2b × markup_categoria         │
│   • SI NO existe → precio_b2b × 4.0 (fallback)                         │
│                                                                         │
│ Resultado: v_pvp_calculado                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PASO 2: Verificar si existe precio B2C mayor                            │
├─────────────────────────────────────────────────────────────────────────┤
│ SELECT precio_venta                                                     │
│ FROM seller_catalog                                                     │
│ WHERE source_product_id = producto_id                                   │
│   AND is_active = TRUE                                                  │
│   AND precio_venta > 0                                                  │
│   AND precio_venta > v_pvp_calculado  ← SOLO SI ES MAYOR               │
│                                                                         │
│ SI precio B2C > calculado → RETORNAR precio B2C                         │
│ NO existe o es menor → RETORNAR v_pvp_calculado                         │
└─────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║                    EJEMPLOS DE CÁLCULO                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝

Ejemplo 1: Precio B2C MAYOR que el calculado
  • Producto: Zapatillas Nike
  • precio_b2b: $10.00
  • markup_categoria: 4.0 → Calculado: $10 × 4.0 = $40.00
  • Seller A lo vende en B2C a: $45.00 (MAYOR)
  • Resultado: PVP sugerido = $45.00 ✓ (usa B2C porque es mayor)

Ejemplo 2: Precio B2C MENOR que el calculado
  • Producto: Reloj Casio
  • precio_b2b: $8.00
  • markup_categoria: 5.0 → Calculado: $8 × 5.0 = $40.00
  • Seller B lo vende en B2C a: $35.00 (MENOR)
  • Resultado: PVP sugerido = $40.00 ✓ (usa calculado porque es mayor)

Ejemplo 3: Producto NUEVO sin precio B2C
  • Producto: Cable USB
  • precio_b2b: $2.00
  • markup_categoria: NULL → Calculado: $2 × 4.0 = $8.00
  • No existe en catálogo B2C
  • Resultado: PVP sugerido = $8.00 ✓ (usa calculado)

Ejemplo 4: Protección contra precios B2C muy bajos
  • Producto: Laptop
  • precio_b2b: $200.00
  • markup_categoria: 3.0 → Calculado: $200 × 3.0 = $600.00
  • Seller C lo puso en oferta a: $500.00 (MENOR que calculado)
  • Resultado: PVP sugerido = $600.00 ✓ (ignora B2C bajo)

╔═══════════════════════════════════════════════════════════════════════════╗
║              CONFIGURACIÓN POR CATEGORÍA DESDE EL ADMIN                   ║
╚═══════════════════════════════════════════════════════════════════════════╝

Campo de la tabla: categories.default_markup_multiplier

Valores sugeridos por tipo de producto:
  • Electrónica (alta competencia): 3.0
  • Ropa y moda: 4.5
  • Joyería y accesorios: 5.0
  • Juguetes: 4.0
  • Hogar y decoración: 3.5
  • Bebés: 4.0
  • Deportes: 3.5
  • Belleza y cosméticos: 4.5
  • Por defecto: 4.0

Desde el Admin Panel, se puede:
  1. Ver todas las categorías con sus multiplicadores
  2. Editar el multiplicador de cada categoría
  3. Los cambios se aplican inmediatamente a todos los productos de esa categoría

╔═══════════════════════════════════════════════════════════════════════════╗
║                    ARCHIVOS PARA EJECUTAR                                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

1. ACTUALIZAR_CALCULATE_SUGGESTED_PVP_SIMPLIFICADO.sql
   └─ Actualiza la función calculate_suggested_pvp()
   └─ Verifica que categories.default_markup_multiplier existe
   └─ Ejecutar: \i ACTUALIZAR_CALCULATE_SUGGESTED_PVP_SIMPLIFICADO.sql

2. CONFIGURAR_MULTIPLICADORES_CATEGORIAS.sql
   └─ Configura multiplicadores por defecto para categorías existentes
   └─ Muestra cómo actualizar desde el Admin Panel
   └─ Ejecutar: \i CONFIGURAR_MULTIPLICADORES_CATEGORIAS.sql

3. CREAR_VISTA_PRECIO_SUGERIDO_CON_LOGISTICA.sql (Actualizada)
   └─ Vista que incluye logística + PVP sugerido
   └─ Refleja la nueva lógica simplificada
   └─ Ejecutar: \i CREAR_VISTA_PRECIO_SUGERIDO_CON_LOGISTICA.sql

╔═══════════════════════════════════════════════════════════════════════════╗
║                        VENTAJAS DE LA NUEVA LÓGICA                        ║
╚═══════════════════════════════════════════════════════════════════════════╝

✓ Más simple y predecible
✓ El admin controla los multiplicadores por categoría
✓ Protege contra precios B2C demasiado bajos
✓ Usa precio B2C solo si es MEJOR (más alto) que el calculado
✓ Mantiene márgenes consistentes según la categoría
✓ No necesita precio_sugerido_venta manual en cada producto
✓ No depende de otros sellers (v_product_max_pvp ya no se usa)
✓ Fácil de entender y explicar al equipo

╔═══════════════════════════════════════════════════════════════════════════╗
║                          ORDEN DE EJECUCIÓN                               ║
╚═══════════════════════════════════════════════════════════════════════════╝
*/

-- Paso 1: Actualizar la función
\i ACTUALIZAR_CALCULATE_SUGGESTED_PVP_SIMPLIFICADO.sql

-- Paso 2: Configurar multiplicadores por categoría
\i CONFIGURAR_MULTIPLICADORES_CATEGORIAS.sql

-- Paso 3: Crear/actualizar la vista con logística
\i CREAR_VISTA_PRECIO_SUGERIDO_CON_LOGISTICA.sql

-- Paso 4: Verificar todo funcionando
SELECT 
  sku,
  product_name,
  precio_b2b,
  costo_logistica_actual,
  costo_total_con_logistica,
  pvp_sugerido,
  origen_pvp,
  categoria_markup
FROM v_precio_sugerido_con_logistica
ORDER BY sku
LIMIT 10;
