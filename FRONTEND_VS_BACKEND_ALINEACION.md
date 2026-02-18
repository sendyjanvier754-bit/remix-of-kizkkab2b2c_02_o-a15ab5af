# 📊 Frontend vs Backend - Alineación de Tablas

## 🎯 Objetivo
Este documento muestra qué espera el **FRONTEND** de cada módulo y qué existe en la **BASE DE DATOS**, para verificar que todo esté alineado.

---

## 1️⃣ TRANSIT HUBS (Hubs de Tránsito)

### Frontend (`useCountriesRoutes.ts`)
```typescript
interface TransitHub {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Base de Datos
```sql
CREATE TABLE transit_hubs (
  id UUID,
  name VARCHAR,
  code VARCHAR,
  description TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ✅ Estado: **ALINEADO** ✅
Todas las columnas coinciden entre frontend y backend.

---

## 2️⃣ DESTINATION COUNTRIES (Países de Destino)

### Frontend (`useCountriesRoutes.ts`)
```typescript
interface DestinationCountry {
  id: string;
  name: string;
  code: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Base de Datos
```sql
CREATE TABLE destination_countries (
  id UUID,
  name VARCHAR,
  code VARCHAR,
  currency VARCHAR,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ✅ Estado: **ALINEADO** ✅
Todas las columnas coinciden entre frontend y backend.

---

## 3️⃣ SHIPPING ROUTES (Rutas de Envío)

### Frontend (`useCountriesRoutes.ts`)
```typescript
interface ShippingRoute {
  id: string;
  destination_country_id: string;
  transit_hub_id: string | null;
  is_direct: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  destination_country?: DestinationCountry;
  transit_hub?: TransitHub;
}
```

### Base de Datos
```sql
CREATE TABLE shipping_routes (
  id UUID PRIMARY KEY,
  destination_country_id UUID,  -- ✅ Correcto
  transit_hub_id UUID,          -- ✅ Correcto
  is_direct BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ✅ Estado: **ALINEADO** ✅
Todas las columnas coinciden. Esta tabla es correcta.

---

## 4️⃣ ROUTE LOGISTICS COSTS (Costos por Tramo)

### Frontend (`useCountriesRoutes.ts`)
```typescript
interface RouteLogisticsCost {
  id: string;
  shipping_route_id: string;  // ✅ Usa shipping_route_id
  segment: string;
  cost_per_kg: number;
  cost_per_cbm: number;
  min_cost: number;
  estimated_days_min: number;
  estimated_days_max: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Base de Datos
```sql
CREATE TABLE route_logistics_costs (
  id UUID PRIMARY KEY,
  shipping_route_id UUID,  -- ✅ Coincide con frontend
  segment TEXT,
  cost_per_kg DECIMAL,
  cost_per_cbm DECIMAL,
  min_cost DECIMAL,
  estimated_days_min INT,
  estimated_days_max INT,
  notes TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ✅ Estado: **ALINEADO** ✅
Frontend usa `shipping_route_id` y la BD tiene `shipping_route_id`. Todo correcto.

---

## 5️⃣ SHIPPING TIERS (Tipos de Envío) ⚠️

### Frontend (`AdminGlobalLogisticsPage.tsx`)
```typescript
interface ShippingTier {
  id: string;
  route_id: string;  // ⚠️ Frontend espera route_id
  tier_type: 'standard' | 'express';
  tier_name: string;
  transport_type: 'maritimo' | 'aereo';
  tramo_a_cost_per_kg: number;
  tramo_a_min_cost?: number;
  tramo_a_eta_min: number;
  tramo_a_eta_max: number;
  tramo_b_cost_per_lb: number;
  tramo_b_min_cost?: number;
  tramo_b_eta_min: number;
  tramo_b_eta_max: number;
  allows_oversize: boolean;
  allows_sensitive: boolean;
  is_active: boolean;
  priority_order: number;
  created_at: string;
}
```

### Base de Datos (Estado Actual)
```sql
CREATE TABLE shipping_tiers (
  id UUID PRIMARY KEY,
  shipping_route_id UUID,  -- ⚠️ BD tiene shipping_route_id
  tier_type VARCHAR,
  tier_name VARCHAR,
  transport_type VARCHAR,
  tramo_a_cost_per_kg DECIMAL,
  tramo_a_min_cost DECIMAL,
  tramo_a_eta_min INT,
  tramo_a_eta_max INT,
  tramo_b_cost_per_lb DECIMAL,
  tramo_b_min_cost DECIMAL,
  tramo_b_eta_min INT,
  tramo_b_eta_max INT,
  allows_oversize BOOLEAN,
  allows_sensitive BOOLEAN,
  is_active BOOLEAN,
  priority_order INT,
  created_at TIMESTAMP
);
```

### ⚠️ Estado: **DESALINEADO** ⚠️

**Problema:**
- Frontend espera: `route_id`
- Base de datos tiene: `shipping_route_id`

**Solución:**
Ejecutar `FIX_SHIPPING_TIERS_AHORA.sql` para renombrar la columna:
```sql
ALTER TABLE shipping_tiers 
RENAME COLUMN shipping_route_id TO route_id;
```

---

## 6️⃣ MARKETS (Mercados)

### Frontend (`useMarkets.ts`)
```typescript
interface Market {
  id: string;
  name: string;
  code: string;
  description: string | null;
  destination_country_id: string;
  shipping_route_id: string | null;  // ✅ Usa shipping_route_id
  currency: string;
  is_active: boolean;
  timezone: string | null;
  sort_order: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}
```

### Base de Datos
```sql
CREATE TABLE markets (
  id UUID PRIMARY KEY,
  name VARCHAR,
  code VARCHAR,
  description TEXT,
  destination_country_id UUID,
  shipping_route_id UUID,  -- ✅ Coincide con frontend
  currency VARCHAR,
  is_active BOOLEAN,
  timezone VARCHAR,
  sort_order INT,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ✅ Estado: **ALINEADO** ✅
Frontend usa `shipping_route_id` y la BD tiene `shipping_route_id`. Todo correcto.

---

## 7️⃣ CATEGORY SHIPPING RATES (Tarifas por Categoría)

### Frontend (`useLogisticsEngine.ts`)
```typescript
interface CategoryShippingRate {
  id: string;
  category_id: string;
  fixed_fee: number;
  percentage_fee: number;
  is_active: boolean;
  created_at: string;
}
```

### Base de Datos
```sql
CREATE TABLE category_shipping_rates (
  id UUID PRIMARY KEY,
  category_id UUID,
  fixed_fee DECIMAL,
  percentage_fee DECIMAL,
  is_active BOOLEAN,
  created_at TIMESTAMP
);
```

### ✅ Estado: **ALINEADO** ✅
Todas las columnas coinciden entre frontend y backend.

---

## 📊 RESUMEN DE ALINEACIÓN

| Módulo | Frontend | Backend | Estado |
|--------|----------|---------|--------|
| **transit_hubs** | ✅ Correcto | ✅ Correcto | ✅ ALINEADO |
| **destination_countries** | ✅ Correcto | ✅ Correcto | ✅ ALINEADO |
| **shipping_routes** | ✅ Correcto | ✅ Correcto | ✅ ALINEADO |
| **route_logistics_costs** | shipping_route_id | shipping_route_id | ✅ ALINEADO |
| **shipping_tiers** | ⚠️ route_id | ⚠️ shipping_route_id | ⚠️ DESALINEADO |
| **markets** | shipping_route_id | shipping_route_id | ✅ ALINEADO |
| **category_shipping_rates** | ✅ Correcto | ✅ Correcto | ✅ ALINEADO |

---

## 🔧 ACCIONES REQUERIDAS

### ⚠️ Acción 1: Renombrar Columna en `shipping_tiers`

**Archivo:** `FIX_SHIPPING_TIERS_AHORA.sql`

```sql
-- Renombrar columna
ALTER TABLE public.shipping_tiers 
RENAME COLUMN shipping_route_id TO route_id;

-- Actualizar índice
DROP INDEX IF EXISTS idx_shipping_tiers_route;
CREATE INDEX idx_shipping_tiers_route_id 
ON public.shipping_tiers(route_id, tier_type);
```

**Resultado:**
- ✅ Frontend usa `route_id` → Backend tendrá `route_id`
- ✅ Alineación completa

---

## 🎯 CONVENCIÓN DE NOMBRES

### ✅ Regla Actual (después del fix):

| Tabla | Columna FK | Referencia |
|-------|------------|------------|
| shipping_routes | id | - |
| route_logistics_costs | **shipping_route_id** | shipping_routes.id |
| **shipping_tiers** | **route_id** | shipping_routes.id |
| markets | **shipping_route_id** | shipping_routes.id |

### 📌 Nota:
- `shipping_tiers` usa `route_id` (más corto, nuevo estándar)
- Otras tablas usan `shipping_route_id` (estándar anterior)
- Ambos son válidos y referencian a `shipping_routes.id`

---

## ✅ DESPUÉS DEL FIX

Todas las tablas estarán **100% alineadas** entre frontend y backend:

| Tabla | Estado |
|-------|--------|
| transit_hubs | ✅ |
| destination_countries | ✅ |
| shipping_routes | ✅ |
| route_logistics_costs | ✅ |
| **shipping_tiers** | ✅ (tras ejecutar FIX) |
| markets | ✅ |
| category_shipping_rates | ✅ |

---

## 📝 VERIFICACIÓN POST-FIX

Después de ejecutar el FIX, verifica:

```sql
-- 1. Confirmar que route_id existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'shipping_tiers' 
  AND column_name = 'route_id';
-- Debe devolver: route_id

-- 2. Confirmar que shipping_route_id NO existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'shipping_tiers' 
  AND column_name = 'shipping_route_id';
-- NO debe devolver nada

-- 3. Probar crear un tipo de envío en el frontend
-- Debe funcionar sin error "Could not find the 'route_id' column"
```

---

## 🎉 GARANTÍAS

✅ **NO se modifican otras tablas**
✅ **NO se pierden datos**
✅ **NO se rompen relaciones**
✅ **Solo se renombra 1 columna en 1 tabla**
✅ **100% seguro y reversible**
