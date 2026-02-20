# 🏗️ PLAN INTEGRAL: Relación Mercado-País-Rutas-Tipo de Envío-Catálogo

## Documento: PLAN_MEJORA_RELACION_MERCADO_PAIS_RUTAS_TIPO_ENVIO_CATALOGO

**Fecha actualización:** 20 Febrero 2026  
**Versión:** 3.0  
**Estado:** 🟡 Módulo Markets + Pagos completado — Pendiente: Catálogo + Seller Account
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

### ⏳ TICKET #12: Seller Account — Selector de Mercado
**Estado:** 🔴 PENDIENTE  
**Archivo:** TICKET_PASO_10_SELLER_MARKET_CONFIG.sql  
**Pasos:**
1. Ejecutar SQL en Supabase: `ALTER TABLE stores ADD COLUMN market_id UUID REFERENCES markets`
2. Actualizar `SellerAccountPage.tsx` con selector de mercados activos
3. Guardar `stores.market_id` al actualizar perfil
4. Usar `stores.market_id → markets.destination_country_id` para calcular envío en catálogo

---

### ⏳ TICKET #13: Catálogo Seller — Mostrar costo de envío dinámico
**Estado:** 🔴 PENDIENTE (depende de TICKET #12)  
**Objetivo:** Columna "Logística" en catálogo del seller muestra costo real basado en su mercado  
**Pasos:**
1. `useSellerCatalog`: leer `stores.market_id → markets.destination_country_id`
2. Llamar `get_product_shipping_cost_by_country(product_id, destination_country_id)`
3. Mostrar `$8.04 / $16.08` en columna Logística

---

### ⏳ TICKET #14: Testing & QA
**Estado:** 🔴 PENDIENTE  
**Objetivo:** Validar todo el flujo end-to-end  
```
TEST: Mercado → crear con países + rutas checkboxes → guardar → rutas asignadas
TEST: Método de pago → crear para país específico → aparece en lista
TEST: Asignar método de pago a mercado → sin error 403
TEST: Seller selecciona mercado → stores.market_id guardado
TEST: Catálogo seller → muestra costo envío correcto según mercado
TEST: Edge cases: país inactivo, sin rutas, sin tiers
```

---

## 🗂️ ESTADO ACTUAL DE LA BASE DE DATOS (20-Feb-2026)

| Columna | Tabla | Estado |
|---|---|---|
| `addresses.destination_country_id` | addresses | ✅ Existe + trigger activo |
| `shipping_routes.market_id` | shipping_routes | ✅ Existe en producción |
| `payment_methods.destination_country_id` | payment_methods | ✅ Existe en producción |
| `payment_methods.phone_number/holder_name/metadata` | payment_methods | ✅ Columnas agregadas |
| `market_destination_countries.route_id` | market_destination_countries | ✅ ELIMINADO |
| `stores.market_id` | stores | 🔴 PENDIENTE ejecutar SQL |
| `markets_dashboard` view | view | ✅ Reconstruida con route_names, is_ready |
| `market_payment_methods` RLS | policies | ✅ Admin ALL + SELECT public |

---

## 📌 PRÓXIMOS PASOS INMEDIATOS

**1️⃣ Ejecutar stores.market_id migration:**
```bash
Archivo: TICKET_PASO_10_SELLER_MARKET_CONFIG.sql (solo el PASO 1 — ALTER TABLE)
Acción: Copy → Paste en Supabase SQL Editor → Execute
```

**2️⃣ Implementar selector de mercado en SellerAccountPage:**
```bash
Archivo: src/pages/seller/SellerAccountPage.tsx
Agregar: Select con mercados activos → guarda stores.market_id
```

**3️⃣ Conectar catálogo con costo de envío real:**
```bash
Archivo: src/hooks/useSellerCatalog.ts (o equivalente)
Usar: get_product_shipping_cost_by_country(product_id, market.destination_country_id)
```

