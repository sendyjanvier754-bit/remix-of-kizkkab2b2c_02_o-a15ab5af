# 🗺️ Mapa Visual de Tablas - Qué se Modifica y Qué NO

## 📋 PASO 1: Ejecuta la Auditoría

Abre Supabase SQL Editor y ejecuta:
```
AUDITORIA_SUPABASE.sql
```

Esto te mostrará el estado ACTUAL de todas las tablas sin modificar nada.

---

## 🎯 PASO 2: Revisa este Mapa Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                    MÓDULO DE LOGÍSTICA                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  TRANSIT_HUBS        │  ✅ NO SE MODIFICA
│  ─────────────       │
│  • id                │
│  • name              │
│  • code              │
│  • is_active         │
└──────────────────────┘
         │
         │ referencias por transit_hub_id
         ▼
┌──────────────────────┐
│ DESTINATION_         │  ✅ NO SE MODIFICA
│ COUNTRIES            │
│  ─────────────       │
│  • id                │
│  • name              │
│  • code              │
│  • currency          │
│  • is_active         │
└──────────────────────┘
         │
         │ referencias por destination_country_id
         ▼
┌──────────────────────────────────────────────────────────────┐
│  SHIPPING_ROUTES (Tabla Principal)                          │  ✅ NO SE MODIFICA
│  ───────────────────────────────                            │
│  • id  ← PK (Esta columna se usa en todas las relaciones)  │
│  • destination_country_id                                    │
│  • transit_hub_id                                           │
│  • is_direct                                                │
│  • is_active                                                │
└──────────────────────────────────────────────────────────────┘
              │
              │
       ┌──────┴──────────┬──────────────┬─────────────┐
       │                 │              │             │
       ▼                 ▼              ▼             ▼
┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────┐
│  ROUTE_     │  │ SHIPPING_   │  │ MARKETS  │  │ SHIPPING_│
│  LOGISTICS_ │  │ TIERS       │  │          │  │ TYPE_    │
│  COSTS      │  │             │  │          │  │ CONFIGS  │
│             │  │             │  │          │  │          │
│  ✅ NO SE   │  │ ⚠️ SE       │  │ ✅ NO SE │  │ ✅ NO SE │
│  MODIFICA   │  │ RENOMBRA    │  │ MODIFICA │  │ MODIFICA │
│             │  │ 1 COLUMNA   │  │          │  │          │
└─────────────┘  └─────────────┘  └──────────┘  └──────────┘

Usa:             Usa:             Usa:           Usa:
shipping_        shipping_        shipping_      shipping_
route_id         route_id  ⚠️     route_id       route_id
                 (actual)                        
✅ CORRECTO      Debe ser:        ✅ CORRECTO    ✅ CORRECTO
                 route_id ✅
```

---

## 📊 DETALLE DE CADA TABLA

### 1. TRANSIT_HUBS ✅
```
Estado: NO SE MODIFICA
Datos: Permanecen iguales
Relaciones: Funcionan igual
```

### 2. DESTINATION_COUNTRIES ✅
```
Estado: NO SE MODIFICA
Datos: Permanecen iguales
Relaciones: Funcionan igual
```

### 3. SHIPPING_ROUTES ✅ (Tabla Central)
```
Estado: NO SE MODIFICA
Datos: Permanecen iguales
Columna PK: id (sin cambios)
Relaciones: Todas funcionan igual

Esta tabla es la MADRE de todas las relaciones.
Su columna 'id' es referenciada por:
- route_logistics_costs.shipping_route_id
- shipping_tiers.shipping_route_id (actual) → route_id (después del fix)
- markets.shipping_route_id
- shipping_type_configs.shipping_route_id
```

### 4. ROUTE_LOGISTICS_COSTS ✅
```
Estado: NO SE MODIFICA
Columna FK: shipping_route_id
Referencia: shipping_routes.id
Datos: Permanecen iguales
Frontend: Usa shipping_route_id ✅
Backend: Tiene shipping_route_id ✅
Estado: ALINEADO ✅
```

### 5. SHIPPING_TIERS ⚠️ (ÚNICA TABLA QUE CAMBIA)
```
Estado: SE RENOMBRA 1 COLUMNA
Cambio: shipping_route_id → route_id
Referencia: shipping_routes.id (sigue igual)
Datos: Permanecen TODOS iguales
Cantidad de datos: NO cambia
Valores: NO cambian
Relaciones: Funcionan igual (solo cambia el nombre)

Frontend: Espera route_id ⚠️
Backend: Tiene shipping_route_id ⚠️
Estado: DESALINEADO ⚠️

DESPUÉS DEL FIX:
Frontend: Espera route_id ✅
Backend: Tiene route_id ✅
Estado: ALINEADO ✅
```

### 6. MARKETS ✅
```
Estado: NO SE MODIFICA
Columna FK: shipping_route_id
Referencia: shipping_routes.id
Datos: Permanecen iguales
Frontend: Usa shipping_route_id ✅
Backend: Tiene shipping_route_id ✅
Estado: ALINEADO ✅
```

### 7. CATEGORY_SHIPPING_RATES ✅
```
Estado: NO SE MODIFICA
Datos: Permanecen iguales
Relaciones: Funcionan igual
```

---

## 🔍 COMPARACIÓN: ANTES vs DESPUÉS

### ANTES del Fix:

```sql
-- shipping_tiers (problema)
CREATE TABLE shipping_tiers (
  id UUID,
  shipping_route_id UUID,  -- ⚠️ Frontend espera route_id
  tier_type VARCHAR,
  -- ... otras columnas
);

-- route_logistics_costs (correcto)
CREATE TABLE route_logistics_costs (
  id UUID,
  shipping_route_id UUID,  -- ✅ Correcto
  segment TEXT,
  -- ... otras columnas
);

-- markets (correcto)
CREATE TABLE markets (
  id UUID,
  shipping_route_id UUID,  -- ✅ Correcto
  -- ... otras columnas
);
```

### DESPUÉS del Fix:

```sql
-- shipping_tiers (corregido)
CREATE TABLE shipping_tiers (
  id UUID,
  route_id UUID,  -- ✅ Ahora coincide con frontend
  tier_type VARCHAR,
  -- ... otras columnas
);

-- route_logistics_costs (sin cambios)
CREATE TABLE route_logistics_costs (
  id UUID,
  shipping_route_id UUID,  -- ✅ Sigue igual
  segment TEXT,
  -- ... otras columnas
);

-- markets (sin cambios)
CREATE TABLE markets (
  id UUID,
  shipping_route_id UUID,  -- ✅ Sigue igual
  -- ... otras columnas
);
```

---

## ✅ GARANTÍAS DEL FIX

### ✅ NO SE TOCA:
- ❌ `transit_hubs` - CERO cambios
- ❌ `destination_countries` - CERO cambios
- ❌ `shipping_routes` - CERO cambios (tabla madre)
- ❌ `route_logistics_costs` - CERO cambios
- ❌ `markets` - CERO cambios
- ❌ `category_shipping_rates` - CERO cambios
- ❌ `shipping_type_configs` - CERO cambios (si existe)

### ✅ SE TOCA (solo 1 tabla):
- ✅ `shipping_tiers` - Solo renombra 1 columna

### ✅ DATOS:
- ✅ NO se borran datos
- ✅ NO se duplican datos
- ✅ NO se pierden relaciones
- ✅ Los valores permanecen exactamente iguales

### ✅ RELACIONES:
```
ANTES:
shipping_tiers.shipping_route_id → shipping_routes.id

DESPUÉS:
shipping_tiers.route_id → shipping_routes.id
```
La relación sigue funcionando, solo cambia el nombre de la columna.

---

## 🚦 SEMÁFORO DE CAMBIOS

| Tabla | Estructura | Datos | Relaciones | FKs | Índices |
|-------|------------|-------|------------|-----|---------|
| transit_hubs | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios |
| destination_countries | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios |
| shipping_routes | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios |
| route_logistics_costs | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios |
| **shipping_tiers** | 🟡 Rename 1 col | 🟢 Sin cambios | 🟢 Sin cambios | 🟡 Actualizado | 🟡 Actualizado |
| markets | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios |
| category_shipping_rates | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios | 🟢 Sin cambios |

🟢 = Sin cambios
🟡 = Cambio cosmético (solo nombre)
🔴 = Cambio importante (ninguno)

---

## 📝 ORDEN DE EJECUCIÓN

### 1. AUDITORÍA (Ver estado actual sin modificar nada)
```bash
Archivo: AUDITORIA_SUPABASE.sql
Acción: Solo SELECT (lectura)
Modifica: Nada
```

### 2. FIX (Renombrar 1 columna en 1 tabla)
```bash
Archivo: FIX_SHIPPING_TIERS_AHORA.sql
Acción: ALTER TABLE RENAME COLUMN
Modifica: shipping_tiers.shipping_route_id → route_id
Tablas afectadas: 1 (shipping_tiers)
Datos afectados: 0 (solo cambia nombre)
```

### 3. VERIFICACIÓN (Confirmar que todo funciona)
```bash
1. Probar crear tipo de envío en AdminGlobalLogisticsPage
2. Verificar que no aparece error "Could not find the 'route_id' column"
3. Confirmar que los datos siguen iguales
```

---

## 🎯 RESUMEN EJECUTIVO

**Pregunta:** ¿Se van a alterar las rutas, tramos, mercados, hubs, categorías?

**Respuesta:** **NO**. Solo se renombra 1 columna en 1 tabla (`shipping_tiers`).

**Impacto:**
- ✅ 7 tablas totales
- ✅ 6 tablas sin ningún cambio
- ⚠️ 1 tabla con rename de 1 columna
- ✅ 0 tablas con pérdida de datos
- ✅ 0 tablas eliminadas
- ✅ 0 relaciones rotas

**Riesgo:** **MUY BAJO** (solo cambio de nombre)

**Reversible:** **SÍ** (ver sección Rollback en otros documentos)

**Tiempo estimado:** < 1 segundo

---

## 📞 PRÓXIMOS PASOS

1. ✅ Ejecuta `AUDITORIA_SUPABASE.sql` en Supabase SQL Editor
2. ✅ Revisa los resultados - verás el estado actual
3. ✅ Lee `FRONTEND_VS_BACKEND_ALINEACION.md` - comprende qué está desalineado
4. ✅ Si todo se ve bien, ejecuta `FIX_SHIPPING_TIERS_AHORA.sql`
5. ✅ Prueba crear un tipo de envío en el admin panel
6. ✅ Verifica que funcione sin errores

---

## ✅ CONCLUSIÓN

**El fix es SEGURO porque:**
1. Solo afecta 1 tabla de 7
2. Solo renombra 1 columna
3. No modifica datos
4. No rompe relaciones
5. Es completamente reversible

**Después del fix:**
- ✅ Frontend y backend 100% alineados
- ✅ Puedes crear tipos de envío sin errores
- ✅ Todas las rutas, tramos, mercados, hubs funcionan igual
- ✅ Ningún dato se pierde
