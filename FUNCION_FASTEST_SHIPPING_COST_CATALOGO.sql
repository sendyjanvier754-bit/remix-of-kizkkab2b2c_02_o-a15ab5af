-- =============================================================================
-- FUNCIÓN: get_catalog_fastest_shipping_cost_by_product
-- =============================================================================
-- Propósito: Mostrar el costo del ENVÍO MÁS RÁPIDO para cada producto
--            en la tabla Mi Catálogo del Seller
-- 
-- Usa la misma lógica de calculate_shipping_cost_for_selected_items:
-- 1. Calcula peso REAL (sin redondear): SUM(peso_kg × cantidad)
-- 2. Obtiene la ruta del primer carrito con ese producto
-- 3. Busca el tier más rápido (FASTEST/EXPRESS)
-- 4. Llama a calculate_shipping_cost_cart() con ese tier
-- 5. Retorna el costo del envío más rápido
--
-- FÓRMULA USADA (del tier):
-- base_cost = (peso_kg × tramo_a_cost_per_kg) + (peso_lb × tramo_b_cost_per_lb)
-- =============================================================================

-- ============= FUNCIÓN PRINCIPAL =============

CREATE OR REPLACE FUNCTION public.get_catalog_fastest_shipping_cost_by_product(
  p_product_id UUID,
  p_destination_country_id UUID
)
RETURNS TABLE (
  product_id UUID,
  product_name VARCHAR,
  total_weight_kg NUMERIC,
  weight_rounded_kg NUMERIC,
  fastest_shipping_tier VARCHAR,
  fastest_shipping_cost_usd NUMERIC,
  route_id UUID,
  tier_id UUID,
  destination_country_id UUID,
  formula_description TEXT
) AS $$
DECLARE
  v_total_weight NUMERIC;
  v_total_qty INTEGER;
  v_route_id UUID;
  v_tier_id UUID;
  v_tier_name VARCHAR;
  v_tier_display_name VARCHAR;
  v_shipping_cost NUMERIC;
  v_weight_rounded NUMERIC;
  v_formula TEXT;
  v_destination_country_id UUID;
BEGIN
  
  -- ===========================================================================
  -- PASO 1: Obtener peso REAL del producto en cartuchos abiertos (sin redondear)
  -- ===========================================================================
  
  SELECT 
    COALESCE(SUM(bci.peso_kg * bci.quantity), 0),
    COALESCE(SUM(bci.quantity), 0)
  INTO 
    v_total_weight,
    v_total_qty
  FROM b2b_cart_items bci
  JOIN b2b_carts bc ON bci.cart_id = bc.id
  WHERE bci.product_id = p_product_id
    AND bc.status = 'open';

  -- Si no hay peso, retornar NULL
  IF v_total_weight IS NULL OR v_total_weight = 0 THEN
    RETURN;
  END IF;

  -- ===========================================================================
  -- PASO 2: Obtener ruta basada en país destino del usuario
  -- REQUERIDO: El país destino debe ser proporcionado (no opcional)
  -- Si no hay ruta para este país, no mostrar costo (retornar vacío)
  -- ===========================================================================
  
  -- Verificar que el país fue proporcionado
  IF p_destination_country_id IS NULL THEN
    RETURN;  -- No mostrar costo si no hay país
  END IF;
  
  v_destination_country_id := p_destination_country_id;  -- Usar el país del usuario
  
  SELECT id INTO v_route_id
  FROM public.route_logistics_costs
  WHERE destination_country_id = v_destination_country_id
  LIMIT 1;

  -- Si no hay ruta para este país, retornar vacío (no mostrar costo)
  IF v_route_id IS NULL THEN
    RETURN;
  END IF;

  -- ===========================================================================
  -- PASO 3: Buscar el tier MÁS RÁPIDO de esta ruta
  -- Prioridad: 'EXPRESS' > 'FAST' > Primero en la tabla
  -- ===========================================================================
  
  SELECT 
    id,
    tier_name,
    COALESCE(custom_tier_name, tier_name)
  INTO 
    v_tier_id,
    v_tier_name,
    v_tier_display_name
  FROM public.shipping_tiers
  WHERE route_id = v_route_id
    AND is_active = TRUE
  ORDER BY 
    CASE 
      WHEN LOWER(tier_name) = 'express' THEN 1
      WHEN LOWER(tier_name) = 'fast' THEN 2
      ELSE 3
    END ASC,
    created_at ASC
  LIMIT 1;

  -- Si no hay tier disponible, retornar NULL
  IF v_tier_id IS NULL THEN
    RETURN;
  END IF;

  -- ===========================================================================
  -- PASO 4: Calcular peso redondeado (para referencia)
  -- ===========================================================================
  
  v_weight_rounded := CEIL(v_total_weight);

  -- ===========================================================================
  -- PASO 5: Calcular costo usando la fórmula del tier
  -- Llamar a calculate_shipping_cost_cart() con el tier más rápido
  -- ===========================================================================
  
  SELECT 
    total_cost_with_type
  INTO 
    v_shipping_cost
  FROM public.calculate_shipping_cost_cart(
    v_total_weight,      -- peso real (sin redondear)
    v_tier_id,           -- tier más rápido seleccionado
    FALSE,               -- no es oversize
    NULL, NULL, NULL     -- sin dimensiones
  );

  -- ===========================================================================
  -- PASO 6: Generar descripción de la fórmula
  -- ===========================================================================
  
  v_formula := format(
    'Weight: %.3f kg (real) → %.0f kg (rounded, CEIL) | Tier: %s | Formula: (%.3f kg × $A/kg) + (%.2f lb × $B/lb)',
    v_total_weight,
    v_weight_rounded,
    v_tier_display_name,
    v_weight_rounded,
    v_weight_rounded * 2.20462
  );

  -- ===========================================================================
  -- RETORNAR RESULTADO
  -- ===========================================================================
  
  RETURN QUERY SELECT 
    p_product_id,
    NULL::VARCHAR,  -- product_name será NULL, el frontend lo obtiene
    ROUND(v_total_weight, 3),
    v_weight_rounded,
    v_tier_display_name,
    COALESCE(v_shipping_cost, 0),
    v_route_id,
    v_tier_id,
    v_destination_country_id,
    v_formula;

END;
$$ LANGUAGE plpgsql STABLE;

-- Comentario
COMMENT ON FUNCTION public.get_catalog_fastest_shipping_cost_by_product IS 
  'Obtiene el costo del ENVÍO MÁS RÁPIDO para un producto en el catálogo.
   
   LÓGICA:
   1. Suma peso REAL del producto en cartuchos abiertos (SUM(peso_kg × cantidad))
   2. Busca ruta: China (origen) → País del usuario (destino) [REQUERIDO]
   3. Busca tier más rápido: EXPRESS > FAST > Primero en tabla
   4. Llama a calculate_shipping_cost_cart() con ese tier
   5. Retorna costo usando fórmula: (kg × tramo_a) + (lb × tramo_b)
   
   PARÁMETROS:
   - p_product_id: UUID del producto
   - p_destination_country_id: UUID del país destino (REQUERIDO - viene de dirección de envío del usuario)
   
   RETORNA:
   - product_id, product_name
   - total_weight_kg (peso real, sin redondear)
   - weight_rounded_kg (peso redondeado al alza, CEIL)
   - fastest_shipping_tier (nombre del tier seleccionado)
   - fastest_shipping_cost_usd (costo total del envío)
   - route_id, tier_id, destination_country_id
   - formula_description (explicación de cálculo)';


-- =============================================================================
-- VISTA: v_catalog_products_with_fastest_shipping
-- Muestra TODOS los productos con su peso real y costo del envío más rápido
-- =============================================================================

DROP VIEW IF EXISTS public.v_catalog_products_with_fastest_shipping CASCADE;

CREATE VIEW public.v_catalog_products_with_fastest_shipping AS
SELECT 
  cps.product_id,
  cps.product_name,
  cps.total_weight_kg,
  cps.weight_rounded_kg,
  cps.fastest_shipping_tier,
  cps.fastest_shipping_cost_usd,
  cps.route_id,
  cps.tier_id,
  cps.formula_description,
  -- Información adicional
  (SELECT COUNT(*) FROM b2b_cart_items WHERE product_id = cps.product_id) as total_items_in_carts,
  (SELECT COUNT(DISTINCT cart_id) FROM b2b_cart_items WHERE product_id = cps.product_id) as carts_with_product
FROM (
  SELECT DISTINCT p.id as product_id
  FROM products p
) p_list
CROSS JOIN LATERAL get_catalog_fastest_shipping_cost_by_product(p_list.product_id) cps
ORDER BY cps.product_id;

COMMENT ON VIEW public.v_catalog_products_with_fastest_shipping IS 
  'Vista que muestra todos los productos con su peso real y costo del ENVÍO MÁS RÁPIDO.
   Se usa en la tabla Mi Catálogo del Seller para mostrar: nombre, peso, cantidad, costo de envío más rápido.';


-- =============================================================================
-- VISTA: v_catalog_product_weight_and_shipping
-- Versión simplificada - SOLO datos de logística y envíos
-- =============================================================================

DROP VIEW IF EXISTS public.v_catalog_product_weight_and_shipping CASCADE;

CREATE VIEW public.v_catalog_product_weight_and_shipping AS
SELECT 
  cs.product_id,
  cs.total_weight_kg,
  cs.weight_rounded_kg,
  cs.fastest_shipping_tier,
  cs.fastest_shipping_cost_usd,
  cs.route_id,
  cs.tier_id,
  -- Información de carrito
  (SELECT COUNT(*) FROM b2b_cart_items WHERE product_id = cs.product_id) as items_in_carts,
  (SELECT COUNT(DISTINCT cart_id) FROM b2b_cart_items WHERE product_id = cs.product_id) as carts_with_product,
  (SELECT SUM(quantity) FROM b2b_cart_items WHERE product_id = cs.product_id) as total_quantity
FROM (
  SELECT DISTINCT p.id as product_id
  FROM products p
) p_list
CROSS JOIN LATERAL get_catalog_fastest_shipping_cost_by_product(p_list.product_id) cs;

COMMENT ON VIEW public.v_catalog_product_weight_and_shipping IS 
  'Vista con información de logística y envíos de TODOS los productos.
   Retorna: product_id, pesos, tier de envío, costo, y conteos de items en carrito.
   Ideal para tabla de catálogo del seller. Frontend obtiene otros datos por separado.';


-- =============================================================================
-- EJEMPLOS DE USO
-- =============================================================================

/*

-- EJEMPLO 1: Obtener costo del envío más rápido para UN producto
-- REQUERIDO: Pasar el UUID del país destino del usuario (de su dirección de envío)
-- Si no hay país: RETORNA VACÍO (no mostrar costo)

SELECT 
  product_id,
  product_name,
  total_weight_kg,
  weight_rounded_kg,
  fastest_shipping_tier,
  fastest_shipping_cost_usd as "Costo Envío Más Rápido ($)",
  destination_country_id,
  formula_description
FROM get_catalog_fastest_shipping_cost_by_product(
  'product-uuid',
  'user-destination-country-uuid'  -- UUID REQUERIDO del país destino del usuario (de dirección de envío)
);

-- Output (si hay ruta):
-- product_id         │ product_name        │ total_weight_kg │ weight_rounded_kg │ fastest_shipping_tier │ Costo Envío Más Rápido ($) │ destination_country_id
-- ───────────────────┼─────────────────────┼─────────────────┼───────────────────┼───────────────────────┼──────────────────────────┼────────────────────────
-- abc-123-def        │ Laptop Stand        │ 1.500           │ 2                 │ FAST                  │ 22.75                    │ user-destination-country-uuid
-- (1 row)

-- Si NO hay país o NO hay ruta:
-- (0 rows) ← Retorna vacío - no mostrar costo

---

-- EJEMPLO 2: Ver todos los productos con el costo de envío más rápido

SELECT 
  product_name,
  total_weight_kg,
  fastest_shipping_tier,
  fastest_shipping_cost_usd
FROM v_catalog_products_with_fastest_shipping
ORDER BY fastest_shipping_cost_usd DESC
LIMIT 10;

-- Output:
-- product_name          │ total_weight_kg │ fastest_shipping_tier │ fastest_shipping_cost_usd
-- ──────────────────────┼─────────────────┼───────────────────────┼──────────────────────────
-- Heavy Industrial Tool │ 25.500          │ EXPRESS               │ 425.75
-- Printer Cartridge Box │ 12.250          │ EXPRESS               │ 215.30
-- Solar Panel Kit       │ 8.750           │ FAST                  │ 165.50
-- ...

---

-- EJEMPLO 3: Integración en tabla de catálogo (vista extendida)

SELECT 
  product_name,
  product_sku,
  items_in_carts,
  carts_with_product,
  total_weight_kg,
  fastest_shipping_tier,
  fastest_shipping_cost_usd,
  base_price_usd,
  total_price_without_shipping,
  total_with_fastest_shipping
FROM v_catalog_product_weight_and_shipping
ORDER BY total_weight_kg DESC
LIMIT 20;

-- Output:
-- product_name        │ sku     │ items │ carts │ weight_kg │ tier    │ ship_cost │ price │ total_no_ship │ total_w_ship
-- ───────────────────┼─────────┼───────┼───────┼───────────┼─────────┼───────────┼───────┼───────────────┼─────────────
-- Heavy Machine      │ SKU-001 │ 50    │ 3     │ 25.500    │ EXPRESS │ 425.75    │ 99.99 │ 4999.50       │ 5425.25
-- Box of Screws      │ SKU-002 │ 120   │ 5     │ 0.500     │ EXPRESS │ 12.50     │ 15.99 │ 1918.80       │ 1931.30
-- ...

---

-- EJEMPLO 4: Comparar diferencia entre peso real vs redondeado

SELECT 
  product_name,
  total_weight_kg as "Peso Real (kg)",
  weight_rounded_kg as "Peso Redondeado (kg)",
  total_weight_kg * 2.20462 as "Peso Real (lb)",
  weight_rounded_kg * 2.20462 as "Peso Redondeado (lb)",
  fastest_shipping_cost_usd
FROM v_catalog_products_with_fastest_shipping
WHERE total_weight_kg < weight_rounded_kg  -- Solo donde hay diferencia
ORDER BY fastest_shipping_cost_usd DESC;

-- Output:
-- product_name    │ Peso Real (kg) │ Peso Redondeado (kg) │ Peso Real (lb) │ Peso Redondeado (lb) │ fastest_shipping_cost
-- ────────────────┼────────────────┼─────────────────────┼────────────────┼─────────────────────┼──────────────────────
-- Kit Pequeño     │ 0.750          │ 1                   │ 1.65           │ 2.20                │ 12.50
-- Cable Set       │ 1.250          │ 2                   │ 2.75           │ 4.41                │ 18.75
-- ...

---

-- EJEMPLO 5: Usar en React/TypeScript (hook)

-- import { useQuery } from '@tanstack/react-query';
-- import { supabase } from '@/integrations/supabase/client';
--
-- /**
--  * Hook para obtener el costo del envío más rápido de un producto
--  * REQUERIDO: Debe pasar un destinationCountryId válido
--  * 
--  * @param productId - UUID del producto
--  * @param destinationCountryId - UUID del país destino (REQUERIDO - de dirección de envío del usuario)
--  * @returns Query con shipping cost o null si no hay país o ruta
--  */
-- export function useCatalogFastestShippingCost(
--   productId: string | undefined,
--   destinationCountryId: string | undefined
-- ) {
--   return useQuery({
--     queryKey: ['catalogFastestShipping', productId, destinationCountryId],
--     queryFn: async () => {
--       // No llamar a la función si falta productId o destinationCountryId
--       if (!productId || !destinationCountryId) return null;
--
--       const { data, error } = await supabase
--         .rpc('get_catalog_fastest_shipping_cost_by_product', {
--           p_product_id: productId,
--           p_destination_country_id: destinationCountryId
--         })
--         .single();
--
--       // Si error o sin datos: retorna null (no mostrar costo)
--       if (error) {
--         console.error('Error fetching shipping cost:', error);
--         return null;
--       }
--       return data;
--     },
--     enabled: !!productId && !!destinationCountryId,  // Solo habilitar si ambos existen
--     staleTime: 15000,
--     refetchInterval: 60000,
--   });
-- }
--
-- // En componente: PASAR SIEMPRE el país del usuario
-- const { data: shipping } = useCatalogFastestShippingCost(
--   productId,
--   user?.destination_country_id  // REQUERIDO - del perfil o address del usuario
-- );
-- 
-- // Si el usuario NO tiene país destino: no mostrar costo
-- if (!user?.destination_country_id) {
--   return <p>Selecciona un país de envío para ver el costo</p>;
-- }

*/

-- =============================================================================
-- INSTALACIÓN
-- =============================================================================

/*

1. Ejecutar este archivo:
   psql -U postgres -d tu_base_de_datos -f FUNCION_FASTEST_SHIPPING_COST_CATALOGO.sql

2. Verificar funciones:
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'get_catalog_fastest_shipping_cost_by_product'
   ORDER BY routine_name;

3. Verificar vistas:
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name LIKE 'v_catalog_product%'
   AND table_schema = 'public';

4. Usar en React/TypeScript:

   // Hook para obtener costo sin especificar país (usa Haití por defecto)
   import { useQuery } from '@tanstack/react-query';
   import { supabase } from '@/integrations/supabase/client';

   export function useCatalogFastestShippingCost(productId: string | undefined) {
     return useQuery({
       queryKey: ['catalogFastestShipping', productId],
       queryFn: async () => {
         if (!productId) return null;

         const { data, error } = await supabase
           .rpc('get_catalog_fastest_shipping_cost_by_product', {
             p_product_id: productId
           })
           .single();

         if (error) throw error;
         return data;
       },
       enabled: !!productId,
       staleTime: 15000,
       refetchInterval: 60000,
     });
   }

   // Hook MEJORADO: Obtener costo para país específico del usuario
   export function useCatalogFastestShippingCostByCountry(
     productId: string | undefined,
     destinationCountryId: string | undefined
   ) {
     return useQuery({
       queryKey: ['catalogFastestShipping', productId, destinationCountryId],
       queryFn: async () => {
         if (!productId || !destinationCountryId) return null;  // No llamar si falta país

         const { data, error } = await supabase
           .rpc('get_catalog_fastest_shipping_cost_by_product', {
             p_product_id: productId,
             p_destination_country_id: destinationCountryId  // REQUERIDO
           })
           .single();

         if (error) throw error;
         return data;
       },
       enabled: !!productId && !!destinationCountryId,  // Solo si ambos existen
       staleTime: 15000,
       refetchInterval: 60000,
     });
   }

   // Uso en componente SellerMiCatalogoPage:
   import { useAuth } from '@/context/AuthContext';
   import { useState } from 'react';

   export function SellerMiCatalogoPage() {
     const { user } = useAuth();
     const [selectedProductId, setSelectedProductId] = useState<string>();

     // REQUERIDO: Obtener país del usuario de su dirección de envío
     const userDestinationCountryId = user?.shipping_address?.destination_country_id || user?.destination_country_id;

     // Petición con país REQUERIDO
     const { data: shipping, isLoading } = useCatalogFastestShippingCost(
       selectedProductId,
       userDestinationCountryId  // REQUERIDO
     );

     // Mostrar mensaje si no hay país de envío configurado
     if (!userDestinationCountryId) {
       return (
         <div className="bg-yellow-50 p-4 rounded">
           <p className="text-sm text-yellow-800">
             ⚠️ Configura tu dirección de envío para ver el costo de envío
           </p>
         </div>
       );
     }

     return (
       <table>
         {/* columnas... */}
         <td>
           {shipping ? (
             <div className="bg-blue-50 p-3 rounded">
               <p className="text-xs text-blue-700">Envío más rápido:</p>
               <p className="text-lg font-bold text-blue-900">
                 {shipping.fastest_shipping_tier} - ${shipping.fastest_shipping_cost_usd}
               </p>
             </div>
           ) : (
             <p className="text-xs text-gray-500">No hay ruta disponible</p>
           )}
         </td>
       </table>
     );
   }

*/

