# 🔄 MIGRACIÓN DE ESTRUCTURA: addresses - ANTES vs DESPUÉS

## ANTES (Estado Actual)

```
addresses (ESTADO ACTUAL - SIN destination_country_id)
├─ id: UUID
├─ user_id: UUID FK → auth.users
├─ label: TEXT
├─ full_name: TEXT
├─ phone: TEXT
├─ street_address: TEXT
├─ city: TEXT
├─ state: TEXT
├─ postal_code: TEXT
├─ country: TEXT ← ⚠️ Valor: "Haiti", "Dominican Republic" (NOMBRE, NO UUID)
├─ notes: TEXT
├─ is_default: BOOLEAN
├─ preferred_pickup_point_id: UUID FK → pickup_points
├─ created_at: TIMESTAMP
└─ updated_at: TIMESTAMP

TOTAL COLUMNAS: 15
FK: user_id (auth.users), preferred_pickup_point_id (pickup_points)
PROBLEMA: No hay vinculo estructurado a destination_countries
```

---

## DESPUÉS (Objetivo Final)

```
addresses (ESTADO POSTERIOR - CON destination_country_id)
├─ id: UUID
├─ user_id: UUID FK → auth.users ✅
├─ destination_country_id: UUID FK → destination_countries ✨ NUEVO
├─ label: TEXT
├─ full_name: TEXT
├─ phone: TEXT
├─ street_address: TEXT
├─ city: TEXT
├─ state: TEXT
├─ postal_code: TEXT
├─ country: TEXT ← ⚠️ DEPRECADO (puede renombrarse a country_legacy)
├─ notes: TEXT
├─ is_default: BOOLEAN
├─ preferred_pickup_point_id: UUID FK → pickup_points
├─ created_at: TIMESTAMP
└─ updated_at: TIMESTAMP

TOTAL COLUMNAS: 16 (15 + 1 nueva)
FK: user_id, destination_country_id ✨, preferred_pickup_point_id
VENTAJA: Vinculo estructurado a destination_countries para buscar rutas
```

---

## 📊 DIAGRAMA ER: RELACIONES

### ANTES
```
auth.users
    │
    ↓ user_id
addresses ←─── (no hay vinculo directo a logística)

destination_countries ←── (no vinculado a addresses)
```

### DESPUÉS
```
auth.users
    │
    ↓ user_id
addresses
    │
    ├─ user_id FK → auth.users
    │
    └─ destination_country_id FK ↓ ✨ NUEVO
        │
        destination_countries ←── ✅ Ahora SÍ vinculado
            │
            ↓ id
            shipping_routes (destination_country_id FK)
                │
                ↓ id
                shipping_tiers (route_id FK)
                    │
                    ↓ id
                    (Cálculo de costo → get_catalog_fastest_shipping_cost_by_product)
```

---

## 🔀 MAPEO DE DATOS: country (TEXT) → destination_country_id (UUID)

### Tabla de Mapeo Necesaria

| Valor en addresses.country | Búsqueda en destination_countries | Resultado (destination_country_id) |
|---|---|---|
| "Haiti" | name = "Haiti" | UUID de Haití |
| "Dominican Republic" | name = "Dominican Republic" | UUID de Dominican Republic |
| "Jamaica" | name = "Jamaica" | UUID de Jamaica |
| (null) | - | NULL (usuario sin país asignado) |

### SQL de Mapeo

```sql
-- Buscar mismatch (si algún country no tiene correspondencia)
SELECT 
  DISTINCT a.country,
  COUNT(*) as total_addresses,
  dc.id as destination_country_id,
  dc.name as destination_country_name
FROM addresses a
LEFT JOIN destination_countries dc ON LOWER(TRIM(a.country)) = LOWER(TRIM(dc.name))
GROUP BY a.country, dc.id, dc.name
ORDER BY total_addresses DESC;

-- Ver qué debe migrarse
SELECT 
  country as texto_actual,
  COUNT(*) as addresses_a_migrar
FROM addresses
WHERE destination_country_id IS NULL
GROUP BY country;
```

---

## ⚙️ PASOS TÉCNICOS DE MIGRACIÓN

### PASO 1: Agregar Columna (Sin datos aún)
```sql
ALTER TABLE public.addresses
ADD COLUMN IF NOT EXISTS destination_country_id UUID
REFERENCES public.destination_countries(id) ON DELETE RESTRICT;

-- En este punto: destination_country_id está NULL para todos
```

### PASO 2: Poblar con Mapeo (Buscar UUID)
```sql
UPDATE public.addresses a
SET destination_country_id = dc.id
FROM public.destination_countries dc
WHERE LOWER(TRIM(a.country)) = LOWER(TRIM(dc.name))
  AND a.destination_country_id IS NULL;
```

### PASO 3: Verificar Migración
```sql
-- Ver cuántos se poblaron
SELECT 
  COUNT(*) as total,
  COUNT(destination_country_id) as con_uuid,
  COUNT(*) - COUNT(destination_country_id) as sin_uuid
FROM addresses;

-- Ver cuáles faltan (problemáticos)
SELECT 
  country,
  COUNT(*) as cantidad
FROM addresses
WHERE destination_country_id IS NULL
GROUP BY country;
```

### PASO 4: Crear Índices (Performance)
```sql
CREATE INDEX IF NOT EXISTS idx_addresses_destination_country 
ON public.addresses(destination_country_id);

CREATE INDEX IF NOT EXISTS idx_addresses_user_country 
ON public.addresses(user_id, destination_country_id);
```

### PASO 5: Hacer NOT NULL (Cuando todo esté OK)
```sql
-- ⚠️ SOLO DESPUÉS de verificar que todos los registros tienen UUID
ALTER TABLE public.addresses 
ALTER COLUMN destination_country_id SET NOT NULL;
```

### PASO 6: Deprecar Campo country (Opcional)
```sql
-- Renombrar para audit trail
ALTER TABLE public.addresses 
RENAME COLUMN country TO country_legacy;

-- O simplemente dejar como Nota: Ya no usar, usar destination_country_id
```

---

## 🧪 TEST DESPUÉS DE MIGRACIÓN

### Test 1: Verificar Vinculo
```sql
-- Cada address debe apuntar a un country válido
SELECT 
  a.id,
  a.user_id,
  a.destination_country_id,
  dc.name as country_name,
  dc.is_active
FROM addresses a
JOIN destination_countries dc ON a.destination_country_id = dc.id
LIMIT 10;
-- Esperado: 10 rows (o hasta el total de addresses)
```

### Test 2: Verificar Rutas Disponibles
```sql
-- Para cada país de dirección del usuario, debe haber ruta
SELECT 
  a.user_id,
  a.destination_country_id,
  dc.name as country,
  COUNT(sr.id) as rutas_disponibles
FROM addresses a
JOIN destination_countries dc ON a.destination_country_id = dc.id
LEFT JOIN shipping_routes sr ON dc.id = sr.destination_country_id AND sr.is_active = TRUE
WHERE a.is_default = TRUE
GROUP BY a.user_id, a.destination_country_id, dc.name;
-- Esperado: rutas_disponibles > 0 para cada usuario
```

### Test 3: Ejecutar Función (End-to-End)
```sql
-- Obtener dirección de usuario
SELECT destination_country_id
FROM addresses
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
AND is_default = TRUE;

-- Usar ese UUID en la función
SELECT *
FROM get_catalog_fastest_shipping_cost_by_product(
  p_product_id := '...',  -- UUID de producto
  p_destination_country_id := '...' -- UUID obtenido arriba
);
-- Esperado: Resultados con costo de envío
```

---

## 📋 RESUMEN DE CAMBIOS

| Aspecto | Antes | Después | Impacto |
|--------|-------|---------|--------|
| **Tabla** | addresses | addresses | Sin cambio (mismo nombre) |
| **Campo country** | TEXT (valor) | TEXT (deprecado) | Mantener para audit |
| **Campo destination_country_id** | ❌ No existe | ✅ UUID FK | ⭐ CRÍTICO |
| **Integridad de datos** | Texto sin validar | UUID validado | ✅ Mejor |
| **Función de catálogo** | No funciona | ✅ Funciona | ⭐ OBJETIVO |
| **FK relationships** | 2 (user, pickup) | 3 (user, pickup, country) | ✅ Más robusto |

---

## 🎯 CHECKLIST DE MIGRACIÓN

- [ ] TICKET #02: Ejecutar y confirmar estructura
- [ ] TICKET #03: Análisis de relaciones actuales  
- [ ] TICKET #04: Auditoría de data quality
- [ ] TICKET #05: Plan específico de cambios
- [ ] TICKET #06: Ejecutar DDL (agregar columna)
- [ ] TICKET #06b: Ejecutar mapeo (poblar datos)
- [ ] TICKET #06c: Verificar y crear índices
- [ ] TICKET #07: Test de integridad
- [ ] TICKET #08: Actualizar función de catálogo
- [ ] TICKET #09: Test end-to-end
- [ ] TICKET #10: Deploy a producción
