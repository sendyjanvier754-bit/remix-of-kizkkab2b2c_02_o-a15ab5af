# 🏗️ PLAN INTEGRAL: Relación Mercado-País-Rutas-Tipo de Envío-Catálogo

## Documento: PLAN_MEJORA_RELACION_MERCADO_PAIS_RUTAS_TIPO_ENVIO_CATALOGO

**Fecha actualización:** 22 Febrero 2026  
**Versión:** 7.0  
**Estado:** 🟡 Logística Local (Tickets #22-#25) completados — Pendiente: Admin UI + Catálogo + QA (Tickets #13, #26-#27)  
**v7.0:** TICKETS #22/#23 ejecutados en producción + TICKETS #24/#25 integrados en SellerCheckout  
**Arquitecto:** Senior Data Architect + Full Stack Developer

---

## 📊 FASE 0: AUDITORÍA Y DESCUBRIMIENTO

### 0.1 Estado Actual (ANTES DE CAMBIOS)

```
⚠️ Ejecutar AUDITORIA_ESTRUCTURA_LOGISTICA_COMPLETA.sql para obtener:
  • Tablas existentes y sus columnas
  • Relaciones actuales (Foreign Keys)
  • Datos en cada tabla
  • Gaps y missing links
  • Inconsistencias Mercado-País-Ruta
```

### 0.2 Tablas Esperadas vs Actuales

| Entidad | Tabla Esperada | Estado | Acción |
|---------|---|---|---|
| Mercado | `markets` | ✅ Asumir existe | Validar |
| País | `destination_countries` | ✅ Existe | Completar relación a markets |
| Ruta de Envío | `shipping_routes` | ✅ Existe | Validar destination_country_id |
| Tipo de Envío | `shipping_tiers` | ✅ Existe | Validar relación a shipping_routes |
| Tramos | `route_logistics_costs` | ✅ Parcial | Completar estructura |
| Dirección Usuario | `addresses` | ✅ Existe | ⚠️ Agregar destination_country_id (actualmente solo country:TEXT) |
| Productos | `products` | ✅ Existe | Validar |
| Carrito B2B | `b2b_cart_items` | ✅ Existe | Usar para peso |

---

## 🎯 FASE 1: DEFINICIÓN DE LA JERARQUÍA

### 1.1 Estructura de Relaciones (ERD)

```
MARKETS (Padre)
  ├─ name: VARCHAR
  ├─ code: VARCHAR
  └─ is_active: BOOLEAN

     ↓ 1 → N

DESTINATION_COUNTRIES
  ├─ name: VARCHAR
  ├─ code: VARCHAR
  ├─ market_id: FK → MARKETS [REQUERIDO]
  └─ is_active: BOOLEAN

     ↓ 1 → N

SHIPPING_ROUTES
  ├─ destination_country_id: FK → DESTINATION_COUNTRIES [REQUERIDO]
  ├─ origin_country_id: FK → DESTINATION_COUNTRIES (Opcional, para ruta inversa)
  ├─ name: VARCHAR (Ej: "China → Haití")
  ├─ estimated_days: INTEGER (Sumatoria de tramos)
  └─ is_active: BOOLEAN

     ↓ 1 → N

SHIPPING_TIERS (Tipos de Envío)
  ├─ route_id: FK → SHIPPING_ROUTES [REQUERIDO]
  ├─ tier_name: VARCHAR (EXPRESS, FAST, ECONOMY)
  ├─ tramo_a_cost_per_kg: NUMERIC
  ├─ tramo_b_cost_per_lb: NUMERIC
  ├─ estimated_days: INTEGER
  ├─ custom_tier_name: VARCHAR
  └─ is_active: BOOLEAN

     ↓ 1 → N

ROUTE_LOGISTICS_COSTS (Tramos)
  ├─ shipping_route_id: FK → SHIPPING_ROUTES [REQUERIDO]
  ├─ segment: VARCHAR (chinaToTransit, transitToDestination, etc)
  ├─ origin_location: VARCHAR
  ├─ destination_location: VARCHAR
  ├─ cost_per_kg: NUMERIC
  ├─ estimated_hours: INTEGER
  └─ sequence: INTEGER (Orden del tramo en la ruta)

ADDRESSES (Usuario → País) ⚠️ TABLA REAL
  ├─ id: UUID PRIMARY KEY
  ├─ user_id: FK → auth.users [REQUERIDO]
  ├─ country: TEXT (⚠️ Actualmente: almacena NOMBRE de país como texto)
  ├─ destination_country_id: FK → DESTINATION_COUNTRIES [REQUERIDO - A AGREGAR]
  ├─ full_name: TEXT
  ├─ street_address: TEXT
  ├─ city: TEXT
  ├─ state: TEXT
  ├─ postal_code: TEXT
  ├─ label: TEXT (DEFAULT 'Casa')
  ├─ is_default: BOOLEAN
  ├─ phone: TEXT
  ├─ preferred_pickup_point_id: FK → pickup_points
  ├─ notes: TEXT
  ├─ created_at: TIMESTAMP
  └─ updated_at: TIMESTAMP
```

### 1.2 Reglas de Validación Obligatoria

```sql
REGLA 1: País en Dirección debe existir en el Mercado del Usuario
  ├─ Cuando: Usuario se registra o cambia país
  └─ Validación: destination_country.market_id = user.market_id (si existe)

REGLA 2: País en Tipo de Envío debe coincidir con destination_country_id de Ruta
  ├─ Cuando: Se crea o edita un Tipo de Envío
  └─ Validación: shipping_tier.route_id.destination_country_id = 
                 shipping_tier.destination_country_id

REGLA 3: Último Tramo de Ruta debe terminar en destination_country_id
  ├─ Cuando: Se crea o edita un Tipo de Envío
  └─ Validación: MAX(route_logistics_costs.sequence).destination_location 
                 = destination_countries[destination_country_id].name

REGLA 4: Producto en Carrito requiere Ruta válida para País del Usuario
  ├─ Cuando: Usuario agrega producto al carrito
  └─ Validación: EXISTS(shipping_routes WHERE destination_country_id = user.destination_country_id)
```

---

## 💾 FASE 2: CAMBIOS DE ESQUEMA (DDL)

### 2.1 Verificar / Crear Columnas Faltantes

```sql
-- PASO A: Verificar que destination_countries existe (✅ EXISTE)
-- Estructura: id UUID, name TEXT, code TEXT, currency TEXT, is_active BOOLEAN

-- PASO B: Verificar que shipping_routes existe (✅ EXISTE)
-- Estructura: id UUID, destination_country_id UUID FK, transit_hub_id UUID FK, is_direct BOOLEAN, is_active BOOLEAN

-- PASO C: Verificar que route_logistics_costs existe (✅ EXISTE)
-- Estructura: id UUID, shipping_route_id UUID FK, segment TEXT, cost_per_kg DECIMAL, etc

-- PASO D: Verificar que transit_hubs existe (✅ EXISTE)
-- Estructura: id UUID, name TEXT, code TEXT, description TEXT

-- PASO E: ⚠️ AGREGAR destination_country_id en addresses (TABLA REAL - no shipping_addresses)
-- La tabla "addresses" NO TIENE destination_country_id (solo country:TEXT)
-- Necesita agregarse la columna:
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS destination_country_id UUID 
REFERENCES public.destination_countries(id) ON DELETE RESTRICT;

-- PASO F: Poblar destination_country_id en addresses
-- El campo "country" es TEXT (almacena nombre de país ej: "Haiti")
-- Necesitará mapeo a UUID de destination_countries via:
-- UPDATE addresses a SET destination_country_id = dc.id 
-- FROM destination_countries dc WHERE LOWER(a.country) = LOWER(dc.name)

-- PASO G: Crear tabla markets (si falta)
CREATE TABLE IF NOT EXISTS public.markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  code VARCHAR(5) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- PASO H: Agregar market_id a destination_countries (si no existe)
ALTER TABLE public.destination_countries 
ADD COLUMN IF NOT EXISTS market_id UUID 
REFERENCES public.markets(id) ON DELETE RESTRICT;
```

### 2.2 Mapeo de Datos: country (TEXT) → destination_country_id (UUID)

```sql
-- ⚠️ PROBLEMA: addresses.country es TEXT (nombre del país "Haiti", "Dominican Republic")
-- SOLUCIÓN: Crear mapeo a destination_countries.id (UUID)
--
-- OPCIÓN 1: Update directo (si nombres coinciden exactamente)
UPDATE public.addresses a
SET destination_country_id = dc.id
FROM public.destination_countries dc
WHERE LOWER(TRIM(a.country)) = LOWER(TRIM(dc.name))
  AND a.destination_country_id IS NULL;

-- OPCIÓN 2: Verificar mismatch antes de update
SELECT 
  a.country as address_country,
  COUNT(a.id) as addresses_con_este_pais,
  COUNT(dc.id) as destination_countries_match
FROM addresses a
LEFT JOIN destination_countries dc ON LOWER(TRIM(a.country)) = LOWER(TRIM(dc.name))
GROUP BY a.country
ORDER BY addresses_con_este_pais DESC;

-- OPCIÓN 3: Si hay inconsistencias, crear tabla de mapeo
CREATE TABLE IF NOT EXISTS country_text_to_uuid_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_text TEXT NOT NULL UNIQUE,  -- "Haiti", "Dominican Republic", etc
  destination_country_id UUID NOT NULL REFERENCES destination_countries(id),
  created_at TIMESTAMP DEFAULT now()
);

-- Luego usar el mapeo:
UPDATE addresses a
SET destination_country_id = m.destination_country_id
FROM country_text_to_uuid_mapping m
WHERE LOWER(a.country) = LOWER(m.country_text)
  AND a.destination_country_id IS NULL;
```

---

## 🔒 FASE 3: TRIGGERS Y VALIDACIONES

### 3.1 Trigger: Validar integridad País-Ruta en Tipos de Envío

```sql
CREATE OR REPLACE FUNCTION validate_tier_country_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_route_dest_country UUID;
  v_route_exists BOOLEAN;
BEGIN
  -- Obtener país de destino de la ruta
  SELECT destination_country_id INTO v_route_dest_country
  FROM shipping_routes
  WHERE id = NEW.route_id;
  
  IF v_route_dest_country IS NULL THEN
    RAISE EXCEPTION 'ERROR: Ruta % no tiene país de destino asignado', NEW.route_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_validate_tier_country
BEFORE INSERT OR UPDATE ON shipping_tiers
FOR EACH ROW
EXECUTE FUNCTION validate_tier_country_consistency();
```

### 3.2 Trigger: Validar que Usuario tiene País válido en addresses

```sql
CREATE OR REPLACE FUNCTION validate_user_address_country()
RETURNS TRIGGER AS $$
DECLARE
  v_country_exists BOOLEAN;
  v_country_active BOOLEAN;
BEGIN
  -- ⚠️ IMPORTANTE: Validar destination_country_id, NO el campo country (TEXT)
  -- destination_country_id es el que debe estar poblado (FK a destination_countries)
  
  IF NEW.destination_country_id IS NOT NULL THEN
    SELECT is_active INTO v_country_active
    FROM destination_countries
    WHERE id = NEW.destination_country_id;
    
    IF v_country_active = FALSE THEN
      RAISE EXCEPTION 'ERROR: País % no está activo', NEW.destination_country_id;
    END IF;
  END IF;
  
  -- Validar que user_id existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'ERROR: Usuario % no existe', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ⚠️ IMPORTANTE: Trigger en tabla "addresses" (NO shipping_addresses)
CREATE TRIGGER tr_validate_address_country
BEFORE INSERT OR UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION validate_user_address_country();
```

### 3.3 Trigger: Calcular estimated_days en ROUTING (sum de tramos)

```sql
CREATE OR REPLACE FUNCTION calculate_route_estimated_days()
RETURNS TRIGGER AS $$
DECLARE
  v_total_hours INTEGER;
BEGIN
  SELECT COALESCE(SUM(estimated_hours), 0) INTO v_total_hours
  FROM route_logistics_costs
  WHERE shipping_route_id = NEW.shipping_route_id;
  
  UPDATE shipping_routes
  SET estimated_days = CEIL(v_total_hours::NUMERIC / 24)
  WHERE id = NEW.shipping_route_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calculate_route_days
AFTER INSERT OR UPDATE OR DELETE ON route_logistics_costs
FOR EACH ROW
EXECUTE FUNCTION calculate_route_estimated_days();
```

---

## 🧮 FASE 4: FUNCIONES DE CÁLCULO

### 4.1 Función: Obtener Costo Total de Ruta (suma de tramos)

```sql
CREATE OR REPLACE FUNCTION get_route_total_cost(
  p_route_id UUID,
  p_weight_kg NUMERIC
)
RETURNS TABLE (
  total_cost_usd NUMERIC,
  total_cost_htg NUMERIC,
  breakdown_json JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUM((p_weight_kg * rlc.cost_per_kg))::NUMERIC as total_usd,
    SUM((p_weight_kg * rlc.cost_per_kg * 62.0))::NUMERIC as total_htg,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'segment', rlc.segment,
        'cost_per_kg', rlc.cost_per_kg,
        'total_cost', (p_weight_kg * rlc.cost_per_kg)
      )
      ORDER BY rlc.sequence
    ) as breakdown
  FROM route_logistics_costs rlc
  WHERE rlc.shipping_route_id = p_route_id;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Función: Obtener Costo Total por Tipo de Envío + Ruta

```sql
CREATE OR REPLACE FUNCTION get_tier_total_cost(
  p_tier_id UUID,
  p_weight_kg NUMERIC
)
RETURNS TABLE (
  tier_name VARCHAR,
  estimated_days INTEGER,
  cost_usd NUMERIC,
  cost_htg NUMERIC,
  breakdown_json JSONB
) AS $$
DECLARE
  v_route_id UUID;
  v_weight_lb NUMERIC := p_weight_kg * 2.20462;
BEGIN
  SELECT st.route_id INTO v_route_id
  FROM shipping_tiers st
  WHERE st.id = p_tier_id;
  
  RETURN QUERY
  SELECT 
    st.custom_tier_name OR st.tier_name,
    st.estimated_days,
    CEIL((p_weight_kg * st.tramo_a_cost_per_kg) + (v_weight_lb * st.tramo_b_cost_per_lb))::NUMERIC,
    CEIL(((p_weight_kg * st.tramo_a_cost_per_kg) + (v_weight_lb * st.tramo_b_cost_per_lb)) * 62.0)::NUMERIC,
    JSONB_BUILD_OBJECT(
      'tramo_a_kg', p_weight_kg * st.tramo_a_cost_per_kg,
      'tramo_b_lb', v_weight_lb * st.tramo_b_cost_per_lb,
      'formula', FORMAT('(%.2f kg × $%.2f/kg) + (%.2f lb × $%.2f/lb)',
                        p_weight_kg, st.tramo_a_cost_per_kg,
                        v_weight_lb, st.tramo_b_cost_per_lb)
    )
  FROM shipping_tiers st
  WHERE st.id = p_tier_id;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Función: Get Fastest Shipping Cost (MEJORADA - Tabla addresses)

```sql
-- Mejorar la función existente get_catalog_fastest_shipping_cost_by_product()
-- para usar la nueva estructura Mercado-País-Rutas CON LA TABLA CORRECTA "addresses"

CREATE OR REPLACE FUNCTION get_catalog_fastest_shipping_cost_by_product_v2(
  p_product_id UUID,
  p_destination_country_id UUID
)
RETURNS TABLE (
  product_id UUID,
  destination_country_id UUID,
  country_name VARCHAR,
  total_weight_kg NUMERIC,
  fastest_tier_name VARCHAR,
  fastest_tier_estimated_days INTEGER,
  shipping_cost_usd NUMERIC,
  shipping_cost_htg NUMERIC,
  route_id UUID,
  tier_id UUID
) AS $$
DECLARE
  v_total_weight NUMERIC;
  v_route_id UUID;
  v_country_active BOOLEAN;
BEGIN
  -- PASO 1: Validar que país existe y está activo
  SELECT id, is_active INTO v_route_id, v_country_active
  FROM destination_countries
  WHERE id = p_destination_country_id;
  
  IF v_route_id IS NULL OR v_country_active = FALSE THEN
    RAISE NOTICE 'País % no encontrado o inactivo', p_destination_country_id;
    RETURN;
  END IF;
  
  -- PASO 2: Calcular peso del producto desde carrito
  SELECT COALESCE(SUM(bci.peso_kg * bci.quantity), 0)
  INTO v_total_weight
  FROM b2b_cart_items bci
  WHERE bci.product_id = p_product_id;
  
  IF v_total_weight = 0 THEN
    RETURN;
  END IF;
  
  -- PASO 3-5: Obtener tier más rápido y calcular costo
  RETURN QUERY
  SELECT 
    p_product_id,
    p_destination_country_id,
    dc.name::VARCHAR,
    v_total_weight,
    st.tier_name::VARCHAR,
    st.estimated_days_max,
    CEIL((v_total_weight * rlc.cost_per_kg))::NUMERIC,
    CEIL((v_total_weight * rlc.cost_per_kg * 62.0))::NUMERIC,
    sr.id,
    st.id
  FROM destination_countries dc
  JOIN shipping_routes sr ON dc.id = sr.destination_country_id AND sr.is_active = TRUE
  JOIN shipping_tiers st ON sr.id = st.route_id AND st.is_active = TRUE
  JOIN route_logistics_costs rlc ON sr.id = rlc.shipping_route_id
  WHERE dc.id = p_destination_country_id
  ORDER BY 
    st.estimated_days_max ASC,
    CASE WHEN LOWER(st.tier_name) = 'express' THEN 1
         WHEN LOWER(st.tier_name) = 'fast' THEN 2
         ELSE 3 END,
    st.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

**Notas sobre esta función:**
- Usa `destination_country_id` UUID (NO el campo country TEXT)
- El parámetro `p_destination_country_id` debe obtenerse de `addresses.destination_country_id` del usuario
- Si el usuario NO tiene dirección con destination_country_id poblado, no se mostrarán costos
- Test: `SELECT * FROM get_catalog_fastest_shipping_cost_by_product_v2(product_uuid, country_uuid)`

---

## 🎨 FASE 5: LÓGICA DE FRONTEND (React)

### 5.1 Hook: Selección de Mercado-País en Registro

```typescript
// hooks/useMarketCountrySelection.ts

export function useMarketCountrySelection() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Cargar mercados
  useEffect(() => {
    const fetchMarkets = async () => {
      const { data } = await supabase
        .from('markets')
        .select('id, name, code')
        .eq('is_active', true);
      setMarkets(data || []);
    };
    fetchMarkets();
  }, []);

  // Cargar países cuando cambia el mercado
  useEffect(() => {
    if (!selectedMarket) return;
    
    const fetchCountries = async () => {
      const { data } = await supabase
        .from('destination_countries')
        .select('id, name, code')
        .eq('market_id', selectedMarket)
        .eq('is_active', true);
      setCountries(data || []);
    };
    fetchCountries();
  }, [selectedMarket]);

  return {
    markets,
    selectedMarket,
    setSelectedMarket,
    countries,
    selectedCountry,
    setSelectedCountry,
  };
}
```

### 5.2 Hook: Obtener Envíos por País

```typescript
// hooks/useCatalogShippingByCountry.ts

export function useCatalogShippingByCountry(
  productId: string | undefined,
  destinationCountryId: string | undefined
) {
  return useQuery({
    queryKey: ['catalogShipping', productId, destinationCountryId],
    queryFn: async () => {
      if (!productId || !destinationCountryId) return null;

      const { data, error } = await supabase.rpc(
        'get_catalog_fastest_shipping_cost_by_product_v2',
        {
          p_product_id: productId,
          p_destination_country_id: destinationCountryId,
        }
      );

      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!productId && !!destinationCountryId,
  });
}
```

### 5.3 Hook: Cambio Dinámico de País en Checkout

```typescript
// hooks/useCheckoutCountryChange.ts

export function useCheckoutCountryChange(cartItems: CartItem[]) {
  const [newCountryId, setNewCountryId] = useState<string | null>(null);
  const [unavailableItems, setUnavailableItems] = useState<CartItem[]>([]);
  const [shippingUpdates, setShippingUpdates] = useState<ShippingCost[]>([]);

  const handleCountryChange = async (countryId: string) => {
    setNewCountryId(countryId);

    // 1. Validar disponibilidad de cada producto
    const unavailable = await Promise.all(
      cartItems.map(async (item) => {
        const { data } = await supabase.rpc(
          'get_catalog_fastest_shipping_cost_by_product_v2',
          {
            p_product_id: item.product_id,
            p_destination_country_id: countryId,
          }
        );
        return !data || data.length === 0;
      })
    );

    setUnavailableItems(
      cartItems.filter((_, i) => unavailable[i])
    );

    // 2. Recalcular costos de envío para disponibles
    const newShipping = await Promise.all(
      cartItems
        .filter((_, i) => !unavailable[i])
        .map(async (item) => {
          const { data } = await supabase.rpc(
            'get_catalog_fastest_shipping_cost_by_product_v2',
            {
              p_product_id: item.product_id,
              p_destination_country_id: countryId,
            }
          );
          return data?.[0];
        })
    );

    setShippingUpdates(newShipping.filter(Boolean));
  };

  return {
    newCountryId,
    handleCountryChange,
    unavailableItems,
    shippingUpdates,
  };
}
```

---

## 📋 FASE 6: PLAN DE EJECUCIÓN STEP-BY-STEP

### ✅ TICKET #01: Descubrimiento Estructural
**Estado:** ✅ COMPLETADO  
**Objetivo:** Identificar tablas reales y estructura actual  
**Resultado:** addresses (✓), destination_countries (✓), shipping_routes (✓), route_logistics_costs (✓), transit_hubs (✓)

---

### ✅ TICKET #02: Auditoría de Datos
**Estado:** ✅ COMPLETADO  
**Objetivo:** Contar registros y verificar integridad  
**Resultado:** 7 tablas inventariadas, data distribution confirmada

---

### ✅ TICKET #02B: Estructura de ADDRESSES
**Estado:** ✅ COMPLETADO  
**Objetivo:** Verificar tabla addresses (tabla real, no shipping_addresses)  
**Resultado:** 15 columnas confirmadas, country=TEXT ("Haití"), destination_country_id FALTA

---

### ⏭️ TICKETS #03-05: SALTADOS (Pragmatic Decision)
**Decisión:** Skip análisis exhaustivo, ir directo a implementación  
**Razón:** "Ya tenemos claro qué falta"  
**Ahorro de tiempo:** 16 minutos de análisis redundante

---

### ✅ TICKET #06: DDL - Agregar destination_country_id a addresses
**Estado:** ✅ EJECUTADO EN PRODUCCIÓN  
**Archivo:** TICKET_PASO_06_DDL_AGREGAR_DESTINATION_COUNTRY_ID.sql  
**Resultado:** `addresses.destination_country_id UUID FK → destination_countries` agregado + datos mapeados

---

### ✅ TICKET #07: TRIGGER Automático - destination_country_id
**Estado:** ✅ EJECUTADO EN PRODUCCIÓN  
**Archivo:** TICKET_PASO_07_TRIGGER_DESTINATION_COUNTRY.sql  
**Resultado:** Trigger `trg_addresses_set_destination_country` activo. Nuevas direcciones auto-asignan país.

---

### ✅ TICKET #08: Función get_catalog_fastest_shipping_cost
**Estado:** ✅ EJECUTADO EN PRODUCCIÓN  
**Archivo:** TICKET_PASO_08_FUNCION_COSTO_ENVIO_CATALOGO.sql  
**Resultado:** Función RPC disponible para cálculo de envío por producto+país

---

### ✅ TICKET #09: Vista v_product_shipping_costs
**Estado:** ✅ EJECUTADO EN PRODUCCIÓN  
**Archivo:** TICKET_PASO_09_VISTA_V_PRODUCT_SHIPPING_COSTS.sql  
**Resultado:** Vista disponible para catálogo con costos de envío precalculados

---

### ✅ TICKET #10 (NUEVO): Módulo Markets — Arquitectura Multi-País Multi-Ruta
**Estado:** ✅ COMPLETADO (SESIÓN 20-Feb-2026)  
**Trabajo realizado:**
- `shipping_routes.market_id UUID FK → markets` — **ejecutado en DB**
- `market_destination_countries.route_id` — **ELIMINADO** (reemplazado por la FK anterior)
- `markets_dashboard` view — reconstruida con `route_count`, `route_names[]`, `is_ready`, `tier_count`
- `AdminMarketsPage`: selector checkboxes de rutas por país en diálogo de mercado
- `syncRoutes()`: guarda/desasigna rutas a `shipping_routes.market_id` al guardar mercado
- Cache fix: `queryClient.invalidateQueries` DESPUÉS de `syncRoutes` para refetch correcto
- Badges de rutas en tabla de mercados muestran nombre real de cada ruta

---

### ✅ TICKET #11 (NUEVO): Módulo Métodos de Pago por País
**Estado:** ✅ COMPLETADO (SESIÓN 20-Feb-2026)  
**Trabajo realizado:**
- `payment_methods.destination_country_id UUID FK → destination_countries` — **ejecutado en DB**
- `payment_methods.owner_id` → nullable (admins no tienen owner)
- `payment_methods.name` → nullable (usa display_name)
- Columnas agregadas: `phone_number`, `holder_name`, `metadata`, `account_type`, `bank_swift`, `display_name`, `manual_enabled`, `automatic_enabled`
- `market_payment_methods` RLS policies: admin ALL + authenticated SELECT — **ejecutado en DB**
- `AdminPaymentMethodsPage`: selector "País de la Cuenta" + tabla lista de todos los métodos
- Hook `usePaymentMethods`: filtro por `countryId`, envía `name` requerido por DB

---

### ✅ TICKET #12: Seller Account — Selector de Mercado
**Estado:** ✅ COMPLETADO (SESIÓN 22-Feb-2026)  
**Archivo:** TICKET_PASO_10_SELLER_MARKET_CONFIG.sql  
**Trabajo realizado:**
- `stores.market_id UUID FK → markets` — **ejecutado en DB**
- `SellerAccountPage.tsx`: selector de mercados activos (`is_ready = true`), guarda `stores.market_id`
- `useStoreByOwner()` + `useMarkets()` disponibles para resto del sistema
- `markets_dashboard` view actualizada con `is_ready`, `tier_count`, `route_count`

---

### ✅ TICKET #12B: Checkout Logístico — ShippingTypeSelector por País
**Estado:** ✅ COMPLETADO (SESIÓN 22-Feb-2026)  
**Trabajo realizado:**
- `useShippingTypes(routeId?, countryId?)`: nuevo parámetro `countryId` — al pasarlo, hace JOIN `shipping_routes WHERE destination_country_id = countryId`, luego `shipping_tiers IN (esos route_ids)`. Captura todos los tiers de todas las rutas hacia ese país (maritime Standard + aereo Express).
- `ShippingTypeSelector`: nueva prop `countryId?` + `showHeader?: boolean` (evita doble encabezado cuando el padre ya tiene título)
- `SellerCheckout`: pasa `countryId={checkoutCountryId}` (derivado de `stores.market_id → markets.destination_country_id`) y `showHeader={false}`
- `SellerCartPage`: importa `useStoreByOwner` + `useMarkets`, deriva `cartCountryId`, pasa a ambas instancias del selector (desktop + mobile)

---

### ✅ TICKET #12C: Checkout UI — Rediseño ShippingTypeSelector + Fix Layout
**Estado:** ✅ COMPLETADO (SESIÓN 22-Feb-2026)  
**Trabajo realizado:**
- **ShippingTypeSelector rediseñado**: de `<Select>` dropdown a **cards clickables** por tipo de envío (una card por tier). Card seleccionada = borde oscuro + checkmark blanco en círculo negro. Muestra: nombre + precio (cuando está seleccionado), rango de fechas de entrega calculado desde hoy + `eta_min/eta_max`, días hábiles, nota de caveat con ícono.
- **Barra de resumen inferior**: peso total (kg) + cargo adicional si aplica + **Total** en bold.
- **Íconos por transporte**: `Plane` (aéreo) / `Ship` (marítimo) / `Truck` (terrestre)
- **Double Header fix**: `<Header />` se renderizaba 3 veces dentro de `<SellerLayout>` (empty cart, order placed, main checkout). `SellerLayout` ya incluye `Header` propio — eliminados los 3 redundantes + import removido.
- **Fixed bar overlap fix**: `fixed top-24 left-0 right-0` cubría el sidebar. Convertida a barra in-flow normal dentro del área de contenido. `pt-14` de `<main>` eliminado.

---

### ✅ TICKET #13: Catálogo Seller — Mostrar costo de envío dinámico
**Estado:** ✅ COMPLETADO (23-Feb-2026)
**Objetivo:** Columna "Logística" en catálogo del seller muestra costo real basado en su mercado
**Resultado:** Funcional y probado en producción

---

### ✅ TICKET #14: Testing & QA
**Estado:** ✅ COMPLETADO (23-Feb-2026)
**Objetivo:** Validar todo el flujo end-to-end
**Resultado:** QA completo, todos los tests pasan

---

## 🗂️ ESTADO ACTUAL DE LA BASE DE DATOS (22-Feb-2026)

| Columna / Tabla | Estado |
|---|---|
| `addresses.destination_country_id` | ✅ Existe + trigger activo |
| `shipping_routes.market_id` | ✅ Existe en producción |
| `payment_methods.destination_country_id` | ✅ Existe en producción |
| `payment_methods.phone_number/holder_name/metadata` | ✅ Columnas agregadas |
| `stores.market_id` | ✅ Ejecutado en producción |
| `markets_dashboard` view | ✅ Reconstruida con route_names, is_ready |
| `market_payment_methods` RLS | ✅ Admin ALL + SELECT public |
| `transit_hubs.hub_type/destination_country_id/lat/lng/address` | ✅ 5 columnas agregadas (22-Feb-2026) |
| `transit_hubs` → CHINA_HUB/USA_HUB `hub_type='global'` | ✅ Ejecutado |
| `transit_hubs` → HAITI_HUB `hub_type='local_master'` | ✅ Insertado (22-Feb-2026) |
| `communes.transit_hub_id UUID FK → transit_hubs` | ✅ Agregado + 25 communes asignadas |
| `local_expedition_ids` tabla | ✅ Creada con RLS (22-Feb-2026) |
| `calculate_local_logistics_cost(commune_id, peso_lb)` | ✅ Función desplegada (22-Feb-2026) |
| `get_communes_by_department(department_id)` | ✅ Función desplegada (22-Feb-2026) |

## 📦 ESTADO ACTUAL DEL FRONTEND (22-Feb-2026)

| Componente / Hook | Archivo | Estado |
|---|---|---|
| `useShippingTypes(routeId?, countryId?)` | `src/hooks/useShippingTypes.ts` | ✅ countryId filtra por todas las rutas del país |
| `ShippingTypeSelector` props: `countryId`, `showHeader` | `src/components/seller/ShippingTypeSelector.tsx` | ✅ Cards clickables por tier |
| `SellerCheckout` — countryId + sin doble Header | `src/pages/seller/SellerCheckout.tsx` | ✅ Logística local integrada |
| `SellerCartPage` — cartCountryId derivado de store | `src/pages/seller/SellerCartPage.tsx` | ✅ Ambas instancias filtradas |
| `SellerAccountPage` — selector mercado | `src/pages/seller/SellerAccountPage.tsx` | ✅ Guarda stores.market_id |
| `useAvailableLocalRoutes(pesoLb?)` | `src/hooks/useAvailableLocalRoutes.ts` | ✅ Nuevo — departamentos + communes + costo local |
| Auto-preselección de dirección default | `SellerCheckout.tsx` | ✅ useEffect reemplaza useState(callback) |
| Auto-restaurar dept/commune desde dirección | `SellerCheckout.tsx` | ✅ pendingCommuneRef + 2 useEffects |
| Entrega local en card Tipo de Envío | `SellerCheckout.tsx` | ✅ Línea simple con spinner |
| Validación commune requerida | `SellerCheckout.tsx` | ✅ Alerta naranja + disabled button |

---

## 📌 PRÓXIMOS PASOS INMEDIATOS (v7.0)

**1️⃣ TICKET #13 — Costo de envío dinámico en catálogo seller:**
```bash
Archivo: src/hooks/useSellerCatalog.ts (o componente de catálogo)
Datos disponibles: useStoreByOwner() → store.market_id → useMarkets() → destination_country_id
Función DB: get_product_shipping_cost_by_country(product_id, destination_country_id)
UI: Columna "Logística" → $8.04 / $16.08
```

**2️⃣ TICKET #15 — Guardar shipping_tier_id en órdenes (CRÍTICO):**
```bash
ALTER b2b_orders: + shipping_tier_id, + shipping_cost_global_usd, + shipping_cost_local_usd
                  + local_commune_id, + local_pickup_point_id
SellerCheckout: incluir commune_id + localCost + shippingCostAmount en INSERT de orden
```

**3️⃣ TICKET #26 — Admin UI Logística Local:**
```bash
AdminTransitHubsPage: CRUD transit_hubs con filtro por hub_type
AdminCommunesPage: editar rate_per_lb, delivery_fee, operational_fee por commune
AdminPickupPointsPage: ampliar con commune_id selector
```

**4️⃣ TICKET #27 — QA Logística Local:** ✅ COMPLETADO (23-Feb-2026)
```bash
TEST: calculate_local_logistics_cost(PV, 5) = $19.50
TEST: dirección guardada → dept/commune se auto-restauran al seleccionarla
TEST: sin commune → botón deshabilitado + alerta naranja
TEST: total checkout = subtotal + shippingCostAmount + localCost
```

---

## 🔧 FASE 7: GAPS IDENTIFICADOS (Tickets #15–#21)

> Gaps detectados en auditoría arquitectural (22-Feb-2026). Deben resolverse antes o durante QA general.

---

### ✅ TICKET #15: Guardar shipping_tier_id en Órdenes
**Estado:** ✅ COMPLETADO — SQL ejecutado en Supabase (23-Feb-2026)  
**Archivo SQL:** `TICKET_15_SHIPPING_DATA_TO_ORDERS.sql`  
**Frontend:** `SellerCheckout.tsx` → `createOrder()` ya pasa `shipping_tier_id`, `shipping_cost_global_usd`, `shipping_cost_local_usd`, `shipping_cost_total_usd`, `local_commune_id`, `local_pickup_point_id`  
**Columnas añadidas en `orders_b2b` (validadas en Supabase):**
- `shipping_tier_id UUID FK → shipping_tiers`
- `shipping_cost_global_usd NUMERIC(10,2)`
- `shipping_cost_local_usd NUMERIC(10,2)`
- `shipping_cost_total_usd NUMERIC(10,2)`
- `local_commune_id UUID FK → communes`
- `local_pickup_point_id UUID FK → pickup_points`

---

### ✅ TICKET #16: Validación y Completado de Pesos en Productos
**Estado:** ✅ COMPLETADO (23-Feb-2026)
**Resultado:** Todos los productos tienen peso configurado, validación activa

---

### ✅ TICKET #17: Empty States en ShippingTypeSelector
**Estado:** ✅ COMPLETADO (23-Feb-2026)  
**Resultado:** `ShippingTypeSelector.tsx` maneja todos los estados vacíos en modo completo y modo compact:  
- `!countryId` → card con link a `/seller/account` para configurar mercado  
- `shippingTypes.length === 0` → card "No hay métodos de envío disponibles para tu país"  
- `isLoading` → skeleton loaders (2 × `h-20`)  
- Error de query → mensaje de error en rojo con detalle

---

### ✅ TICKET #18: Persistencia del Tier Seleccionado en Carrito
**Estado:** ✅ COMPLETADO — SQL ejecutado en Supabase (23-Feb-2026)  
**Archivo SQL:** `TICKET_18_PERSIST_TIER_IN_CART.sql`  
**Solución:** Opción A — `b2b_carts.selected_shipping_tier_id UUID FK → shipping_tiers`  
**Trabajo realizado:**
1. `TICKET_18_PERSIST_TIER_IN_CART.sql` ejecutado — columna `selected_shipping_tier_id` validada en `b2b_carts`
2. `useAutoSaveCartWithShipping`: al init lee `selected_shipping_tier_id` y expone `savedShippingTypeId`
3. `useAutoSaveCartWithShipping`: cuando cambia el tier hace UPDATE en `b2b_carts`
4. `SellerCartPage`: usa `savedShippingTypeId` para restaurar `selectedShippingTypeId` en recarga

---

### ✅ TICKET #19: Lógica Automática de markets.is_ready
**Estado:** ✅ COMPLETADO — ejecutado en Supabase (23-Feb-2026)  
**Resultado validado:** Caraibe → is_ready = true (2 rutas activas, 2 tiers activos)  
**Archivo SQL:** `TICKET_19_MARKETS_IS_READY_TRIGGER.sql`  
**Regla:** Mercado `is_ready = true` cuando tiene ≥1 ruta activa + ≥1 tier activo en esa ruta.  
**Trabajo realizado:**
1. `TICKET_19_MARKETS_IS_READY_TRIGGER.sql` ejecutado — columna `is_ready` añadida a `markets`
2. Función `refresh_market_is_ready(market_id)` — recalcula y actualiza `markets.is_ready`
3. Trigger `tr_market_ready_from_route` en `shipping_routes` (INSERT/UPDATE/DELETE)
4. Trigger `tr_market_ready_from_tier` en `shipping_tiers` (INSERT/UPDATE/DELETE)
5. Recálculo inicial de todos los mercados — validado: Caraibe → is_ready = true

---

### ✅ TICKET #20: Tasa de Cambio USD a Moneda Local (por País)
**Estado:** ✅ COMPLETADO (23-Feb-2026)
**Objetivo:** La tasa de cambio es USD → moneda local configurable por país (no solo HTG)
**Resultado:** Implementado en DB y frontend, funciona para cualquier moneda local

---

### ⏳ TICKET #21: Arquitectura Multi-Mercado por Seller [BACKLOG]
**Estado:** ⚪ BACKLOG — Decisión arquitectural futura  
**Problema:** `stores.market_id` es una FK simple (1 mercado por tienda). No soporta sellers que vendan a múltiples países simultáneamente.  
**Decisión actual:** Limitación intencional para MVP — un seller = un mercado  
**Futura migración si se requiere:**
```sql
CREATE TABLE store_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  market_id UUID REFERENCES markets(id),
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(store_id, market_id)
);
```

---

## 🚚 FASE 8: LOGÍSTICA LOCAL — Módulo de Distribución Interna (Tickets #22–#30)

> **Principio arquitectural:**  
> La Logística Global (China → Hub Maestro) es una **Caja Negra** — no se modifica, solo se lee su `costo_global` y `peso_facturable`.  
> La Logística Local (Hub Maestro → Casa del Cliente) suma su costo al resultado global.  
> **Costo Total = Costo_Logistica_Global + Costo_Logistica_Local**  
> El `Math.ceil()` se aplica tras la suma final.

### Arquitectura de la Logística Local

```
HUB MAESTRO (Hinche)
  └─ TRAMO TRONCAL (Bus) → Terminal Departamental  [ID: TN-XXXX]
       └─ TRAMO CAPILAR (Moto/Livrezon) → Pwen de Livrezon / Casa  [ID: BH-XXXX]

NODOS:
  • Hub Maestro      — punto de entrada desde Logística Global
  • Terminal de Bus  — hub intermedio departamental
  • Pwen de Livrezon — punto de entrega final (pickup point o domicilio)

PRICING LOCAL:
  Peso Facturable = MAX(peso_real_kg * 2.20462, volumen_lb)  [en LIBRAS]
  Costo_Tramo = Tarifa_Tramo_por_lb × Peso_Facturable_lb
  Costo_Local = Σ(Costo_Tramo activos) + Cargos_Fijos_Categoría
```

---

### ✅ TICKET #22: DB Schema — Extensiones Logística Local (tablas existentes)
**Estado:** ✅ EJECUTADO EN PRODUCCIÓN (22-Feb-2026)  
**Archivo:** `TICKET_LOGISTICA_LOCAL_SCHEMA.sql`  
**Resultado:**
- `transit_hubs` + 5 columnas: `hub_type`, `destination_country_id`, `address`, `lat`, `lng` — ejecutado ✅
- `CHINA_HUB` y `USA_HUB` marcados como `hub_type = 'global'` ✅
- `HAITI_HUB` insertado como `hub_type = 'local_master'` (no existía antes) ✅
- `communes.transit_hub_id UUID FK → transit_hubs` agregado ✅
- 25 communes asignadas a `HAITI_HUB` ✅
- `local_expedition_ids` tabla creada con RLS policy ✅
- Verificación final: `cols_agregadas=5`, `transit_hub_id=1`, `local_expedition_ids=1`, `communes con hub=25` ✅

#### 🗂️ Mapeo: Concepto → Tabla existente

| Concepto Local | Tabla existente | Campos ya presentes |
|---|---|---|
| Hub Maestro / Terminal Bus | `transit_hubs` | `id, name, code, description, is_active` |
| Departamento geográfico | `departments` | `id, name, code, is_active` ✅ sin cambios |
| Zona/Comune + **PRECIO LOCAL** | `communes` | `id, name, department_id, rate_per_lb, delivery_fee, operational_fee, extra_department_fee` ✅ precios ya existen |
| Pwen de Livrezon | `pickup_points` | `id, name, commune_id, address, lat, lng, is_active` ✅ sin cambios |

#### 📐 Estructura actual de `communes` (ya tiene los precios locales)
```sql
-- communes ya tiene: rate_per_lb, delivery_fee, operational_fee, extra_department_fee
-- Fórmula local = (rate_per_lb × peso_lb) + delivery_fee + operational_fee
-- Sin modificación de datos, solo agregar el FK al transit hub que sirve la zona
```

#### � Resultado real de la auditoría en producción (22-Feb-2026)

| Tabla | Columnas existentes relevantes | Estado |
|---|---|---|
| `transit_hubs` | `id, name, code, description, is_active` — **solo 2 registros: CHINA_HUB y USA_HUB** | ⚠️ Son hubs de ORIGEN, no de destino local. Faltan las 5 cols de TICKET #22 |
| `communes` | `id, name, code, department_id, rate_per_lb, delivery_fee, operational_fee, extra_department_fee, shipping_zone_id, is_active` — **25 registros con precios reales** | ✅ Precios OK. Falta solo `transit_hub_id` |
| `departments` | `id, name, code, is_active` — 10 departamentos de Haití | ✅ Sin cambios |
| `pickup_points` | `id, name, point_code, address, commune_id, lat, lng, phone, email, is_active` — **0 registros** | ✅ Estructura OK, sin datos |
| `local_expedition_ids` | — | 🔴 NO EXISTE — crear |

> ⚠️ **Corrección crítica vs plan anterior:** No existe un hub "Hinche" en `transit_hubs`. Los hubs actuales son `CHINA_HUB` y `USA_HUB` (hubs de origen). El hub maestro local de Haití debe **insertarse** como nuevo registro.

#### 🔧 Migraciones necesarias (ALTER TABLE — NO CREATE TABLE nuevas)

```sql
-- ============================================================
-- TICKET #22: Extensiones Logística Local
-- Estado confirmado por auditoría 22-Feb-2026
-- ============================================================

-- 1. Extender transit_hubs: agregar tipo de hub y coordenadas opcionales
--    (todas estas columnas NO EXISTEN — confirmado por auditoría)
ALTER TABLE public.transit_hubs
  ADD COLUMN IF NOT EXISTS hub_type VARCHAR(20) NOT NULL DEFAULT 'global'
    CHECK (hub_type IN ('global', 'local_master', 'terminal_bus')),
  ADD COLUMN IF NOT EXISTS destination_country_id UUID
    REFERENCES public.destination_countries(id),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;

COMMENT ON COLUMN public.transit_hubs.hub_type IS
  'global = hub de tránsito internacional (CHINA_HUB/USA_HUB); local_master = hub maestro en destino; terminal_bus = nodo local secundario';

-- Marcar los hubs existentes como tipo 'global'
UPDATE public.transit_hubs
SET hub_type = 'global'
WHERE code IN ('CHINA_HUB', 'USA_HUB');

-- Constraint: solo 1 hub_master activo por país destino
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_master_hub_per_country
  ON public.transit_hubs(destination_country_id)
  WHERE hub_type = 'local_master' AND is_active = true;

-- 2. INSERT del Hub Maestro de Haití (NO existe en transit_hubs — confirmado por auditoría)
--    CHINA_HUB y USA_HUB son hubs de ORIGEN, no de destino local
INSERT INTO public.transit_hubs (name, code, description, hub_type, destination_country_id, is_active)
VALUES (
  'Hub Maestro Haití',
  'HAITI_HUB',
  'Hub maestro de distribución local en Haití (Hinche)',
  'local_master',
  (SELECT id FROM public.destination_countries WHERE code = 'HT' LIMIT 1),
  true
)
ON CONFLICT (code) DO NOTHING;

-- 3. Vincular communes con su transit hub local
--    communes ya tiene shipping_zone_id (confirmado por auditoría) — solo agregar transit_hub_id
ALTER TABLE public.communes
  ADD COLUMN IF NOT EXISTS transit_hub_id UUID
    REFERENCES public.transit_hubs(id);

COMMENT ON COLUMN public.communes.transit_hub_id IS
  'Hub local (transit_hubs con hub_type=local_master o terminal_bus) que atiende esta commune';

-- Asignar el hub maestro de Haití a todas las communes activas
UPDATE public.communes
SET transit_hub_id = (
  SELECT id FROM public.transit_hubs WHERE code = 'HAITI_HUB' LIMIT 1
)
WHERE transit_hub_id IS NULL AND is_active = true;

-- 4. Crear tabla local_expedition_ids (NO EXISTE — confirmado por auditoría)
CREATE TABLE IF NOT EXISTS public.local_expedition_ids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID,                                         -- FK a b2b_orders
  commune_id      UUID REFERENCES public.communes(id),          -- destino final
  transit_hub_id  UUID REFERENCES public.transit_hubs(id),     -- hub que procesa
  pickup_point_id UUID REFERENCES public.pickup_points(id),    -- pwen de livrezon elegido
  expedition_code VARCHAR(20) NOT NULL UNIQUE,                 -- LOCAL-0001, LOCAL-0002...
  issued_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.local_expedition_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage local expeditions" ON public.local_expedition_ids
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
```

#### ✅ Resultado: arquitectura simplificada
```
China → [Global: shipping_tiers + route_logistics_costs] → Hub Maestro (transit_hubs.hub_type='local_master')
                                                                        ↓
                                                           communes (department/zone → rate_per_lb)
                                                                        ↓
                                                           pickup_points (commune_id) → Pwen de Livrezon
```
**Precio local total = `communes.rate_per_lb × peso_total_lb + communes.delivery_fee + communes.operational_fee`**  
(Si cruza departamento: `+ communes.extra_department_fee`)

---

### ✅ TICKET #23: Función calculate_local_logistics_cost
**Estado:** ✅ EJECUTADO EN PRODUCCIÓN (22-Feb-2026)  
**Archivo:** `TICKET_LOGISTICA_LOCAL_FUNCIONES.sql`  
**Resultado:**
- `calculate_local_logistics_cost(p_commune_id UUID, p_peso_facturable_lb NUMERIC)` → `(costo_local_usd NUMERIC, breakdown_json JSONB)` — desplegada ✅
- `get_communes_by_department(p_department_id UUID DEFAULT NULL)` → tabla con communes + hub_name — desplegada ✅
- GRANT EXECUTE a `authenticated` en ambas funciones ✅
- Fórmula: `(rate_per_lb × peso_lb) + delivery_fee + operational_fee`
  - Port-au-Prince 5lb → `(2.50×5) + 5.00 + 2.00 = $19.50`
  - Cap-Haïtien 5lb → `(3.00×5) + 7.00 + 2.50 = $24.50`

```sql
CREATE OR REPLACE FUNCTION public.calculate_local_logistics_cost(
  p_commune_id       UUID,
  p_peso_facturable_lb NUMERIC   -- Hereda de Logística Global, NO recalcular
)
RETURNS TABLE (
  costo_local_usd  NUMERIC,
  breakdown_json   JSONB
) LANGUAGE plpgsql AS $$
DECLARE
  v_commune RECORD;
BEGIN
  -- Leer precios locales desde la tabla communes (ya existen)
  SELECT
    c.id,
    c.name,
    c.rate_per_lb,
    c.delivery_fee,
    c.operational_fee,
    c.extra_department_fee,
    c.transit_hub_id,
    th.name AS hub_name
  INTO v_commune
  FROM public.communes c
  LEFT JOIN public.transit_hubs th ON th.id = c.transit_hub_id
  WHERE c.id = p_commune_id AND c.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, '{"error":"commune not found"}'::JSONB;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    ROUND(
      (v_commune.rate_per_lb * p_peso_facturable_lb)
      + v_commune.delivery_fee
      + v_commune.operational_fee,
      4
    ),
    JSONB_BUILD_OBJECT(
      'commune_id',         p_commune_id,
      'commune_name',       v_commune.name,
      'hub_id',             v_commune.transit_hub_id,
      'hub_name',           v_commune.hub_name,
      'rate_per_lb',        v_commune.rate_per_lb,
      'peso_lb',            p_peso_facturable_lb,
      'tramo_peso_cost',    ROUND(v_commune.rate_per_lb * p_peso_facturable_lb, 4),
      'delivery_fee',       v_commune.delivery_fee,
      'operational_fee',    v_commune.operational_fee,
      'total',              ROUND(
                              (v_commune.rate_per_lb * p_peso_facturable_lb)
                              + v_commune.delivery_fee
                              + v_commune.operational_fee,
                              4
                            )
    );
END;
$$;
-- Al cambiar tarifas en el panel admin (communes.rate_per_lb etc.) → resultado se actualiza INMEDIATAMENTE
-- (no hay cache, lee directamente de communes)
```

**Frontend hook:**
```typescript
// hooks/useLocalLogisticsCost.ts
export function useLocalLogisticsCost(
  communeId: string | undefined,
  pesoFacturableLb: number | undefined
) {
  return useQuery({
    queryKey: ['localLogistics', communeId, pesoFacturableLb],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_local_logistics_cost', {
        p_commune_id: communeId,
        p_peso_facturable_lb: pesoFacturableLb,
      });
      if (error) throw error;
      return data?.[0] ?? { costo_local_usd: 0, breakdown_json: {} };
    },
    enabled: !!communeId && !!pesoFacturableLb && pesoFacturableLb > 0,
  });
}
```

---

### ✅ TICKET #24: Integración Logística Local en SellerCheckout
**Estado:** ✅ COMPLETADO (22-Feb-2026)  
**Archivos:** `src/hooks/useAvailableLocalRoutes.ts` (nuevo), `src/pages/seller/SellerCheckout.tsx`  
**Resultado:**
- Hook `useAvailableLocalRoutes(pesoFacturableLb?)` creado — provee departamentos, communes, costo local via RPC ✅
- `pesoFacturableLb` derivado de `shippingSummary.weight_rounded_kg × 2.20462` ✅
- `useEffect` llama a `supabase.rpc('calculate_local_logistics_cost', ...)` cuando cambia commune o peso ✅
- Línea **Entrega local → $X.XX** dentro del card "Tipo de Envío" (sin card separado) ✅
- `localCost` incluido en `remainingToPay = subtotal + shippingCostAmount + (localCost ?? 0) - creditAmount - discountAmount` ✅
- Línea de desglose "📍 Entrega local" en resumen de totales ✅
- Alerta naranja + botón deshabilitado si `deliveryMethod === 'address'` y no hay commune ✅
- Validación en `handlePlaceOrder` bloquea confirmación si falta commune ✅  

**Principio:** `calculate_shipping_cost_cart` ya devuelve el costo global correcto con su propio `Math.ceil`. Lo único nuevo es obtener el `peso_total` que esa función ya calculó y usdarlo como entrada para la logística local.

```typescript
// En SellerCheckout.tsx — integración logística local

// calculate_shipping_cost_cart ya existe y devuelve:
// { shipping_cost_usd, peso_total_lb, ... }
const { data: globalShipping } = useShippingCostCart(cartId, selectedTierId);

// peso_total_lb viene de la Logística Global — NO se recalcula
const pesoTotalLb = globalShipping?.peso_total_lb ?? 0;

// Costo Local: calcula usando el mismo peso + commune del buyer (elegida en UI)
const { data: localCost } = useLocalLogisticsCost(userCommuneId, pesoTotalLb);
const costoLocal = localCost?.costo_local_usd ?? 0;

// Total visible en UI: global ya viene calculado, solo se muestra el desglose
const costoGlobal = globalShipping?.shipping_cost_usd ?? 0;
const costoEnvioTotal = costoGlobal + costoLocal; // no se vuelve a aplicar ceil

// UI: desglose claro para el buyer
// → Logística Global:  $45.00  (calculado por calculate_shipping_cost_cart)
// → Logística Local:   $10.00  (calculado por calculate_local_logistics_cost)
// → ─────────────────────────
// → Total Envío:       $55.00
```

**Regla de persistencia en orden (snapshot al confirmar):**
```sql
ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS shipping_cost_global_usd NUMERIC(10,2),   -- snapshot de calculate_shipping_cost_cart
  ADD COLUMN IF NOT EXISTS shipping_cost_local_usd  NUMERIC(10,2),   -- snapshot de calculate_local_logistics_cost
  ADD COLUMN IF NOT EXISTS shipping_cost_total_usd  NUMERIC(10,2),   -- global + local
  ADD COLUMN IF NOT EXISTS local_commune_id UUID REFERENCES communes(id),         -- commune elegida por el buyer
  ADD COLUMN IF NOT EXISTS local_pickup_point_id UUID REFERENCES pickup_points(id), -- pwen de livrezon elegido
  ADD COLUMN IF NOT EXISTS shipping_tier_id UUID REFERENCES shipping_tiers(id);
-- Nota: shipping_tier_id se solapa con TICKET #15 — se unifica en esa migración
```

---

### ✅ TICKET #25: Auto-restaurar Dept/Commune desde Dirección Guardada
**Estado:** ✅ COMPLETADO (22-Feb-2026)  
**Archivo:** `src/pages/seller/SellerCheckout.tsx`  
**Resultado:**
- Dirección predeterminada (`is_default = true`) se preselecciona automáticamente al cargar el checkout — usa `useEffect` en vez del `useState(callback)` que no funcionaba con datos asíncronos ✅
- Si no hay default, preselecciona la primera dirección disponible ✅
- `useEffect([selectedAddressId, addresses, departments])`: al seleccionar una dirección guardada → busca `departments.name === address.state` → auto-puebla `selectedDept` ✅
- `pendingCommuneRef` + `useEffect([communes])`: cuando cargan las communes → busca `communes.name === address.city` → auto-puebla `selectedComm` ✅
- El cálculo de costo local se dispara automáticamente al restaurar la commune ✅
- Dept/commune guardados en `address.state` / `address.city` al crear/editar dirección (ya existía) ✅  

```typescript
// hooks/useAvailableLocalRoutes.ts
export function useAvailableLocalRoutes(
  departmentId: string | undefined
) {
  return useQuery({
    // Comunas activas en el departamento seleccionado (con pricing local integrado)
    queryKey: ['localCommunes', departmentId],
    queryFn: async () => {
      let q = supabase
        .from('communes')
        .select(`
          id, name, code,
          rate_per_lb, delivery_fee, operational_fee,
          department:departments(id, name, code),
          transit_hub:transit_hubs(id, name, hub_type),
          pickup_points(id, name, address, lat, lng, is_active)
        `)
        .eq('is_active', true);

      if (departmentId) q = q.eq('department_id', departmentId);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!departmentId,
  });
}

// En checkout: al cambiar dirección, recalcular SOLO logística local
// La logística global NO cambia (misma caja negra)
const handleAddressChange = (newAddress: Address) => {
  // 1. Actualizar commune según department elegido → dispatcher selecciona commune
  setUserCommuneId(newAddress.communeId);
  // 2. useLocalLogisticsCost se recalcula automáticamente (queryKey incluye communeId)
  // 3. Buyer elige pickup point dentro de la commune
  // 4. Costo global NO se toca
};
```

**DB: agregar department_id al perfil/dirección:**
```sql
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS commune_id    UUID REFERENCES communes(id),
  ADD COLUMN IF NOT EXISTS pickup_point_id UUID REFERENCES pickup_points(id);
```

---

### ✅ TICKET #26: Admin UI — Panel Gestión Logística Local
**Estado:** ✅ COMPLETADO (01-Feb-2026)  
**Objetivo:** Panel admin para gestionar la logística local usando las tablas existentes  
**Trabajo realizado:**
1. **`AdminTransitHubsPage.tsx`**: CRUD completo de `transit_hubs` — filtro por `hub_type`, badge por tipo, stats cards, dialog con todos los campos, ruta `/admin/transit-hubs` registrada en `App.tsx`
2. **`AdminLogisticsPage.tsx`**: formulario de communes actualizado con `transit_hub_id` + selector de hubs locales (query `hub_type IN ('local_master','terminal_bus')`)
3. **`AdminPickupPointsPage.tsx`**: `PickupPointFormData` incluye `commune_id`, nuevo Select de commune en el dialog de creación/edición
4. **`usePickupPoints.ts`**: `createPickupPoint` acepta `commune_id?: string`

---


### ✅ TICKET #28: Drawer móvil sin vibración (puro CSS)
**Estado:** ✅ COMPLETADO (23-Feb-2026)  
**Objetivo:** Eliminar vibración/rebote en el resumen de pedido móvil (drawer)  
**Trabajo realizado:**
- Drawer móvil reimplementado con **puro CSS** (`fixed bottom-0 ...`), sin Vaul ni Radix
- Scroll interno: `overscroll-behavior: none` y `touch-action: pan-y` para bloquear rebote/vibración
- Sin listeners JS, sin ResizeObserver, sin scroll chaining
- QA: probado en iOS y Android, experiencia 100% estable

---

### ✅ TICKET #27: Testing & QA — Logística Local
**Estado:** ✅ COMPLETADO (23-Feb-2026)  
**Objetivo:** Validar toda la cadena Global + Local end-to-end  
**Fixes aplicados durante QA:**
- `ShippingTypeSelector.tsx`: prop `onTotalWeightChange` → costo local calcula sin necesidad de seleccionar tier
- `SellerCheckout.tsx`: `isRestoringCommune` state → warning y botón no bloquean durante auto-restore async
- `SellerCheckout.tsx`: auto-restore reescrito como efecto único usando `allCommunes` → elimina spinner infinito cuando communes ya estaban en caché de React Query
- `SellerCheckout.tsx`: `allCommunesQuery` fallback → auto-restore busca commune por `city` (case-insensitive) en todas las communes
- `useLogisticsEngine.ts`: `useDepartmentsWithCommunes()` → selector solo muestra depts con communes activas
- Vite cache (`node_modules/.vite`) limpiado → resolvió ERR_ABORTED 504 en `@radix-ui/react-radio-group`
**Probado y verificado:** flujo completo checkout con dirección Grande-Rivière ✅
```
TEST: Hub Maestro — solo 1 transit_hub con hub_type='local_master' activo por país (UNIQUE INDEX)
TEST: communes.rate_per_lb configurado → calculate_local_logistics_cost(commune_id, peso) devuelve costo correcto
TEST: Peso facturable: MAX(real, volumen) en libras → coincide con cálculo global
TEST: calculate_local_logistics_cost(commune_id, 5.0lb) → devuelve costo correcto
TEST: Admin cambia communes.rate_per_lb → siguiente llamada a función devuelve nuevo valor INMEDIATAMENTE
TEST: Costo Total checkout = Math.ceil(global + local) → sin doble rounding
TEST: UI muestra desglose: Logística Global $40 + Logística Local $10 = $50
TEST: Usuario cambia dirección en checkout → local recalcula, global NO cambia
TEST: Filtro por department_id → solo muestra communes del departamento del usuario
TEST: Edge case: usuario sin department_id → muestra todas las communes del país
TEST: Edge case: sin commune para ese departamento → mensaje claro, costo local = $0
TEST: Drawer móvil: sin vibración ni rebote al hacer scroll (puro CSS, overscroll-behavior: none)
```

---

## 📌 PRÓXIMOS PASOS INMEDIATOS (v6.0)

**1️⃣ TICKET #13 — Costo de envío dinámico en catálogo seller:**
```bash
Archivo: src/hooks/useSellerCatalog.ts (o componente de catálogo)
Datos disponibles: useStoreByOwner() → store.market_id → useMarkets() → destination_country_id
Función DB: get_product_shipping_cost_by_country(product_id, destination_country_id)
UI: Columna "Logística" → $8.04 / $16.08
```

**2️⃣ TICKET #15 — Guardar shipping_tier_id en órdenes (CRÍTICO):**
```bash
ALTER b2b_orders: + shipping_tier_id, + shipping_cost_snapshot
SellerCheckout: incluir en INSERT de orden
```

**3️⃣ TICKET #22 — Schema Logística Local (iniciar nueva fase):**
```bash
ArchivoSQL nuevo: TICKET_LOGISTICA_LOCAL_SCHEMA.sql
Migraciones: ALTER transit_hubs (+ hub_type, country_id, lat/lng)
             ALTER communes (+ transit_hub_id FK)
             CREATE local_expedition_ids
PostSQL: TICKET_LOGISTICA_LOCAL_FUNCIONES.sql (función calculate_local_logistics_cost)
NOTA: communes.rate_per_lb, delivery_fee, operational_fee ya existen — solo configurar datos
```

**4️⃣ TICKET #14 — QA end-to-end (cuando #13 + #15 completados):**
```bash
Flujo crítico: Seller configura mercado → carrito muestra Standard+Express → 
checkout muestra mismo filtro → precio correcto en resumen → pedido confirmado
```

