-- =============================================================================
-- ANÁLISIS DETALLADO: Relación usuario → dirección → país → ruta → costo
-- =============================================================================
-- Este script muestra el flujo completo de cómo obtener el costo de envío
-- desde el usuario hasta la función de catálogo

-- =============================================================================
-- PARTE 1: ESTRUCTURA DE TABLAS
-- =============================================================================

SECTION 'PASO 1: Ver estructura de tablas involucradas', 'blue';

-- Tabla 1: destination_countries (países disponibles)
SELECT 'destination_countries' as tabla, COUNT(*) as registros
FROM destination_countries
UNION ALL
-- Tabla 2: shipping_addresses (direcciones de usuario)
SELECT 'shipping_addresses', COUNT(*)
FROM shipping_addresses
UNION ALL
-- Tabla 3: route_logistics_costs (rutas por país)
SELECT 'route_logistics_costs', COUNT(*)
FROM route_logistics_costs
UNION ALL
-- Tabla 4: shipping_tiers (tiers por ruta)
SELECT 'shipping_tiers', COUNT(*)
FROM shipping_tiers
UNION ALL
-- Tabla 5: b2b_cart_items (productos en carrito)
SELECT 'b2b_cart_items', COUNT(*)
FROM b2b_cart_items;

---

-- =============================================================================
-- PARTE 2: FLUJO COMPLETO: Usuario → Dirección → País → Costo
-- =============================================================================

SECTION 'PASO 2: Flujo completo para UN usuario (ejemplo)', 'green';

WITH user_selection AS (
  -- PASO 1: Seleccionar un usuario (reemplaza con tu user_id)
  SELECT id as user_id
  FROM auth.users
  LIMIT 1
),
user_shipping_address AS (
  -- PASO 2: Obtener dirección de envío del usuario
  SELECT 
    u.user_id,
    sa.id as address_id,
    sa.destination_country_id,
    sa.street_address,
    sa.city,
    sa.state,
    sa.postal_code
  FROM user_selection u
  LEFT JOIN shipping_addresses sa ON u.user_id = sa.user_id
  WHERE sa.is_default = TRUE  -- Dirección principal
     OR sa.id = (SELECT MIN(id) FROM shipping_addresses WHERE user_id = u.user_id)
),
destination_country_info AS (
  -- PASO 3: Obtener información del país
  SELECT 
    usa.user_id,
    usa.address_id,
    usa.destination_country_id,
    dc.name as pais_nombre,
    dc.code as codigo_pais,
    usa.street_address,
    usa.city,
    usa.state,
    usa.postal_code
  FROM user_shipping_address usa
  LEFT JOIN destination_countries dc ON usa.destination_country_id = dc.id
),
route_for_country AS (
  -- PASO 4: Obtener ruta disponible para este país
  SELECT 
    dci.user_id,
    dci.address_id,
    dci.destination_country_id,
    dci.pais_nombre,
    dci.codigo_pais,
    rlc.id as route_id,
    rlc.segment,
    rlc.cost_per_kg as costo_por_kg_base,
    dci.street_address,
    dci.city,
    dci.state,
    dci.postal_code
  FROM destination_country_info dci
  LEFT JOIN route_logistics_costs rlc 
    ON dci.destination_country_id = rlc.destination_country_id
    AND rlc.is_active = TRUE
  WHERE rlc.id IS NOT NULL
),
tiers_for_route AS (
  -- PASO 5: Obtener tiers (EXPRESS, FAST, etc)
  SELECT 
    rfc.user_id,
    rfc.address_id,
    rfc.destination_country_id,
    rfc.pais_nombre,
    rfc.codigo_pais,
    rfc.route_id,
    rfc.segment,
    st.id as tier_id,
    st.tier_name,
    st.custom_tier_name,
    st.tramo_a_cost_per_kg,
    st.tramo_b_cost_per_lb,
    rfc.street_address,
    rfc.city,
    rfc.state,
    rfc.postal_code,
    CASE 
      WHEN LOWER(st.tier_name) = 'express' THEN 1
      WHEN LOWER(st.tier_name) = 'fast' THEN 2
      ELSE 3
    END as tier_priority
  FROM route_for_country rfc
  LEFT JOIN shipping_tiers st 
    ON rfc.route_id = st.route_id
    AND st.is_active = TRUE
)
-- RESULTADO FINAL
SELECT 
  user_id,
  pais_nombre,
  codigo_pais,
  address_id,
  destination_country_id,
  route_id,
  tier_id,
  tier_name,
  tramo_a_cost_per_kg,
  tramo_b_cost_per_lb,
  CONCAT(street_address, ', ', city, ', ', state, ' ', postal_code) as direccion_completa,
  '✅ LISTO para llamar función' as estado
FROM tiers_for_route
WHERE tier_priority = (
  SELECT MIN(tier_priority) 
  FROM tiers_for_route t2 
  WHERE t2.route_id = tiers_for_route.route_id
)
ORDER BY tier_priority;

---

-- =============================================================================
-- PARTE 3: CONSULTA RECOMENDADA PARA OBTENER destination_country_id
-- =============================================================================

SECTION 'PASO 3: Consulta para obtener destination_country_id del usuario', 'yellow';

/*
OPCIÓN A: Obtener del usuario actual en React/TypeScript
(Ya tienes el user_id desde el contexto de autenticación)

```typescript
// En tu React component o hook:
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useCatalogShippingCosts() {
  const { user } = useAuth();
  
  // Query to get user's shipping address and destination country
  const { data: userAddress } = useQuery({
    queryKey: ['userShippingAddress', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('shipping_addresses')
        .select('destination_country_id')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .single();
      
      return data;
    }
  });
  
  // Ahora puedes usar userAddress?.destination_country_id en la función
  return userAddress?.destination_country_id;
}
```

OPCIÓN B: Query SQL directa para usuario específico
*/

SELECT 
  u.id as user_id,
  u.email,
  sa.id as address_id,
  sa.destination_country_id,
  dc.name as pais_destino
FROM auth.users u
JOIN shipping_addresses sa ON u.id = sa.user_id
LEFT JOIN destination_countries dc ON sa.destination_country_id = dc.id
WHERE sa.is_default = TRUE  -- Dirección principal/default
ORDER BY u.created_at DESC
LIMIT 20;

---

-- =============================================================================
-- PARTE 4: VALIDAR QUE TODO ESTÁ CONECTADO
-- =============================================================================

SECTION 'PASO 4: Validación - ¿Todo está conectado?', 'red';

-- Validación 1: ¿Hay usuarios con dirección y país?
SELECT 
  'Usuarios con dirección y país asignado' as validacion,
  COUNT(DISTINCT u.id) as cantidad,
  CASE 
    WHEN COUNT(DISTINCT u.id) > 0 THEN '✅ OK'
    ELSE '❌ PROBLEMA: No hay usuarios con dirección'
  END as estado
FROM auth.users u
JOIN shipping_addresses sa ON u.id = sa.user_id
WHERE sa.destination_country_id IS NOT NULL
UNION ALL
-- Validación 2: ¿Hay rutas para esos países?
SELECT 
  'Rutas activas',
  COUNT(*),
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ OK'
    ELSE '❌ PROBLEMA: No hay rutas configuradas'
  END
FROM route_logistics_costs
WHERE is_active = TRUE
UNION ALL
-- Validación 3: ¿Hay tiers en esas rutas?
SELECT 
  'Tiers en rutas',
  COUNT(*),
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ OK'
    ELSE '❌ PROBLEMA: No hay tiers configurados'
  END
FROM shipping_tiers
WHERE is_active = TRUE
UNION ALL
-- Validación 4: ¿Hay productos con peso en carrito?
SELECT 
  'Productos con peso',
  COUNT(DISTINCT product_id),
  CASE 
    WHEN COUNT(DISTINCT product_id) > 0 THEN '✅ OK'
    ELSE '❌ PROBLEMA: No hay productos con peso'
  END
FROM b2b_cart_items
WHERE peso_kg > 0 AND quantity > 0;

---

-- =============================================================================
-- PARTE 5: LISTA DE CHEQUEO PARA IMPLEMENTAR LA FUNCIÓN
-- =============================================================================

/*

LISTA DE CHEQUEO ANTES DE USAR get_catalog_fastest_shipping_cost_by_product:

✅ 1. Estructura de base de datos:
   [ ] route_logistics_costs.destination_country_id existe
   [ ] shipping_addresses.destination_country_id existe
   [ ] destination_countries tabla existe
   [ ] shipping_tiers.route_id existe y está lleno

✅ 2. Datos disponibles:
   [ ] Hay al menos 1 usuario con shipping_address
   [ ] Esa dirección tiene un destination_country_id válido
   [ ] Hay al menos 1 ruta activa (route_logistics_costs)
   [ ] Esa ruta tiene un destino que coincide con un país
   [ ] Hay al menos 1 tier activo en esa ruta
   [ ] Hay productos en carrito con peso (peso_kg > 0)

✅ 3. En React/Frontend:
   [ ] Obtener user_id del contexto de autenticación
   [ ] Obtener destination_country_id de shipping_addresses
   [ ] Validar que destination_country_id no es NULL
   [ ] Pasar ambos parámetros a la función RPC

✅ 4. Llamada a la función:
   [ ] const result = await supabase.rpc('get_catalog_fastest_shipping_cost_by_product', {
         p_product_id: productId,
         p_destination_country_id: destinationCountryId
       })
   [ ] Verificar que result.data no está vacío
   [ ] Si está vacío: mostrar mensaje "No hay ruta disponible para tu país"

*/

---

-- =============================================================================
-- PARTE 6: EJEMPLO PRÁCTICO - Obtener costo para producto específico
-- =============================================================================

SECTION 'PASO 6: Ejemplo práctico - Calcular costo para usuario y producto', 'magenta';

/*
Reemplaza los UUIDs de abajo con valores reales de tu base de datos
*/

-- Opción 1: Con UUIDs específicos
SELECT *
FROM public.get_catalog_fastest_shipping_cost_by_product(
  'PRODUCT-UUID-AQUI'::UUID,
  'DESTINATION-COUNTRY-UUID-AQUI'::UUID
);

-- Opción 2: Obtener automáticamente del primer usuario y producto
WITH user_country AS (
  SELECT DISTINCT sa.destination_country_id
  FROM shipping_addresses sa
  WHERE sa.destination_country_id IS NOT NULL
  LIMIT 1
),
product AS (
  SELECT DISTINCT product_id
  FROM b2b_cart_items
  WHERE peso_kg > 0
  LIMIT 1
)
SELECT *
FROM public.get_catalog_fastest_shipping_cost_by_product(
  (SELECT product_id FROM product),
  (SELECT destination_country_id FROM user_country)
);

---

-- =============================================================================
-- PARTE 7: VISUALIZAR RELACIÓN DE TODAS LAS TABLAS
-- =============================================================================

SECTION 'PASO 7: Diagrama de relaciones', 'white';

/*

FLUJO VISUAL:

auth.users
    ↓ (1 user : many addresses)
shipping_addresses
    ├─→ destination_country_id (FK → destination_countries)
    └─→ user_id (FK → auth.users)
        ↓
destination_countries
    ├─→ id
    └─→ is_active
        ↓
route_logistics_costs
    ├─→ destination_country_id (FK → destination_countries)
    └─→ id
        ↓
shipping_tiers
    ├─→ route_id (FK → route_logistics_costs)
    └─→ is_active
        ↓
        ↓ GET FASTEST TIER
        ↓
get_catalog_fastest_shipping_cost_by_product()
    ├─→ p_product_id
    ├─→ p_destination_country_id ← VIENE DE: user → address → country
    └─→ RETORNA: fastest_shipping_tier, cost, formula

SÍMBOLO:
   ↓  = relación
   FK = Foreign Key (clave foránea)
   
CLAVE:
   El parámetro p_destination_country_id DEBE:
   1. Obtenerse del usuario actual
   2. Desde su dirección de envío (shipping_addresses)
   3. Que tenga destination_country_id asignado
   4. Y ese país debe tener rutas activas (route_logistics_costs)

*/
