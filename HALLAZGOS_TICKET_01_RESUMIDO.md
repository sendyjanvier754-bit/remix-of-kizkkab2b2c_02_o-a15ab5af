# 📋 HALLAZGOS TICKET #01 - RESUMIDO

**Fecha:** 19 Febrero 2026  
**Estado:** ✅ CONFIRMADO  
**Próximo Paso:** TICKET #02

---

## 🎯 DESCUBRIMIENTO PRINCIPAL

### Tabla de Direcciones: `addresses` (NO `shipping_addresses`)

**Tabla:** `public.addresses`

**Estructura Actual:**
```
addresses
├─ id: UUID PRIMARY KEY (gen_random_uuid)
├─ user_id: UUID FK → auth.users [REQUERIDO]
├─ label: TEXT DEFAULT 'Casa' (ej: "Casa", "Oficina", "Almacén")
├─ full_name: TEXT [REQUERIDO]
├─ phone: TEXT
├─ street_address: TEXT [REQUERIDO]
├─ city: TEXT [REQUERIDO]
├─ state: TEXT (nullable)
├─ postal_code: TEXT
├─ country: TEXT DEFAULT 'Haiti' ← ⚠️ **PROBLEMA: Es TEXT, no UUID**
├─ notes: TEXT
├─ is_default: BOOLEAN DEFAULT false
├─ preferred_pickup_point_id: UUID FK → pickup_points (nullable)
├─ created_at: TIMESTAMP WITH TIME ZONE DEFAULT now()
└─ updated_at: TIMESTAMP WITH TIME ZONE DEFAULT now()
```

---

## 🔴 PROBLEMAS IDENTIFICADOS

### ❌ 1. Campo `country` es TEXT, no UUID
- Almacena: "Haiti", "Dominican Republic", etc (nombres textuales)
- Debería: Almacenar UUID de tabla `destination_countries`
- Impacto: No se puede usar para buscar rutas directamente

### ❌ 2. Falta columna `destination_country_id` UUID
- Necesita: Agregarse como FK a `destination_countries(id)`
- Propósito: Vincular dirección del usuario con país de destino UUID
- Prioridad: CRÍTICO para función de catálogo

### ✅ 3. FK `user_id` está correcto
- Existe: FK a `auth.users`
- Uso: Identificar a qué usuario pertenece la dirección
- Estado: ✅ No necesita cambios

---

## ✅ TABLAS DE LOGÍSTICA EXISTENTES

| Tabla | Existe | Columnas Clave | Datos |
|-------|--------|---|---|
| `destination_countries` | ✅ | id, name, code, currency, is_active | ✅ Tiene datos |
| `shipping_routes` | ✅ | id, destination_country_id FK, transit_hub_id FK | ✅ Tiene datos |
| `route_logistics_costs` | ✅ | id, shipping_route_id FK, segment, cost_per_kg | ✅ Tiene datos |
| `transit_hubs` | ✅ | id, name, code, description | ✅ Tiene datos |
| `b2b_cart_items` | ✅ | product_id, cart_id, quantity, peso_kg | ✅ Tiene datos |
| `products` | ✅ | id, name, ... | ✅ Tiene datos |
| `markets` | ❌ | - | - |
| `shipping_tiers` | ❓ | - | TICKET #02 verificará |

---

## 🔧 ACCIÓN REQUERIDA - TICKET #06: DDL

```sql
-- PASO 1: Agregar columna destination_country_id a addresses
ALTER TABLE public.addresses
ADD COLUMN IF NOT EXISTS destination_country_id UUID
REFERENCES public.destination_countries(id) ON DELETE RESTRICT;

-- PASO 2: Mapear country (TEXT) → destination_country_id (UUID)
-- Opción simple (si nombres coinciden exactamente):
UPDATE public.addresses a
SET destination_country_id = dc.id
FROM public.destination_countries dc
WHERE LOWER(TRIM(a.country)) = LOWER(TRIM(dc.name))
  AND a.destination_country_id IS NULL;

-- PASO 3: Verificar que no hay orphaned addresses
SELECT 
  country,
  COUNT(*) as total,
  COUNT(destination_country_id) as con_id,
  COUNT(*) - COUNT(destination_country_id) as sin_id
FROM addresses
GROUP BY country;

-- PASO 4: Si hay mismatches, crear tabla de mapeo
CREATE TABLE IF NOT EXISTS country_text_to_uuid_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_text TEXT NOT NULL UNIQUE,
  destination_country_id UUID NOT NULL REFERENCES destination_countries(id),
  created_at TIMESTAMP DEFAULT now()
);

-- PASO 5: Una vez todo esté poblado, hacer NOT NULL
-- ALTER TABLE addresses ALTER COLUMN destination_country_id SET NOT NULL;
```

---

## 📊 IMPACTO EN FUNCIONES

### Función: `get_catalog_fastest_shipping_cost_by_product()`

**Parámetro requerido:**
```
p_destination_country_id: UUID
├─ Fuente: addresses.destination_country_id (del usuario actual)
├─ Validación: Debe existir y estar activo
└─ Fallback: Si no existe, NO mostrar costo (por diseño)
```

**NO puede usar:**
- ❌ `addresses.country` (TEXT)
- ❌ String de nombre de país

**Ejemplos de obtener el UUID:**

```sql
-- Para usuario actual en checkout:
SELECT destination_country_id
FROM addresses
WHERE user_id = auth.uid()
AND is_default = TRUE;

-- En React (ejemplo):
const defaultAddress = user.addresses.find(a => a.is_default);
const countryId = defaultAddress?.destination_country_id;
```

---

## ✅ PRÓXIMO PASO

**EJECUTAR:** TICKET #02 - ESTRUCTURA DE TABLAS LOGÍSTICAS  
**ARCHIVO:** `TICKET_PASO_02_ESTRUCTURA_TABLAS_LOGISTICAS.sql`

**Verificará:**
- Estructura exacta de shipping_tiers (¿existe? ¿qué columnas?)
- Estructura exacta de route_logistics_costs (costos, segmentos)
- Cantidad de datos en cada tabla (para test)
- FK relationships

**Tiempo:** ~1 minuto

---

## 📝 NOTAS

⚠️ **Importante:** La tabla `addresses` tiene un diseño que mezcla:
- Datos de logística: `country`
- Datos de dirección postal: `street_address`, `city`, etc
- Metadata de dirección: `label`, `is_default`

Esto es correcto, pero requiere migración cuidadosa del campo `country` TEXT → `destination_country_id` UUID.

✅ **Buena noticia:** No hay que crear tabla de direcciones nueva. Solo agregar una columna y mapear datos.
