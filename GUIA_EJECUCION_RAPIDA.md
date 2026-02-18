# 🚀 GUÍA DE EJECUCIÓN: SISTEMA LOGÍSTICA COMPLETO

## 📅 Febrero 16, 2026

## 🎯 RESUMEN EJECUTIVO

**3 Scripts SQL + Frontend Actualizado = Sistema Completo**

1. ✅ Transport type (maritimo/aereo/terrestre)
2. ✅ Nombres editables para rutas
3. ✅ Una ruta = Un tier

---

## ⚡ EJECUCIÓN RÁPIDA

### En Supabase SQL Editor:

```sql
-- 1. PRIMERO: Transport type en route_logistics_costs
ALTER TABLE public.route_logistics_costs
ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20) NOT NULL DEFAULT 'aereo'
CHECK (transport_type IN ('maritimo', 'aereo', 'terrestre'));

UPDATE public.route_logistics_costs SET transport_type = 'aereo';

-- 2. SEGUNDO: Transport type en shipping_tiers  
ALTER TABLE public.shipping_tiers
ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20) NOT NULL DEFAULT 'aereo'
CHECK (transport_type IN ('maritimo', 'aereo', 'terrestre'));

UPDATE public.shipping_tiers
SET transport_type = CASE
  WHEN tier_type = 'standard' THEN 'maritimo'
  WHEN tier_type = 'express' THEN 'aereo'
  ELSE 'aereo'
END;

-- 3. TERCERO: Nombres de rutas y restricción
ALTER TABLE public.shipping_routes
ADD COLUMN IF NOT EXISTS route_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS origin_country VARCHAR(100) DEFAULT 'China',
ADD COLUMN IF NOT EXISTS destination_country VARCHAR(100);

UPDATE public.shipping_routes sr
SET 
  origin_country = 'China',
  destination_country = dc.name_es,
  route_name = 'China → ' || dc.name_es
FROM public.destination_countries dc
WHERE sr.destination_country_id = dc.id
  AND sr.route_name IS NULL;

ALTER TABLE public.shipping_tiers DROP CONSTRAINT IF EXISTS unique_route_tier;
ALTER TABLE public.shipping_tiers ADD CONSTRAINT unique_one_tier_per_route UNIQUE(route_id);
```

---

## 📋 ARCHIVOS INCLUIDOS

1. **ADD_TRANSPORT_TYPE_TO_ROUTE_COSTS.sql** - Transport type en tramos
2. **ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql** - Transport type en tiers (CORREGIDO)
3. **ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql** - Nombres y restricción

---

## ✅ VERIFICACIÓN

```sql
-- Debe retornar filas con transport_type
SELECT * FROM route_logistics_costs LIMIT 1;
SELECT * FROM shipping_tiers LIMIT 1;
SELECT route_name, origin_country, destination_country FROM shipping_routes LIMIT 1;

-- Debe mostrar máximo 1 tier por ruta
SELECT sr.route_name, COUNT(st.id) as tiers
FROM shipping_routes sr
LEFT JOIN shipping_tiers st ON sr.id = st.route_id
GROUP BY sr.route_name;
```

---

## 🔧 SI HAY CONFLICTOS (rutas con múltiples tiers)

```sql
-- Identificar conflictos
SELECT sr.route_name, COUNT(st.id) as cantidad
FROM shipping_routes sr
JOIN shipping_tiers st ON sr.id = st.route_id
GROUP BY sr.route_name
HAVING COUNT(st.id) > 1;

-- SOLUCIÓN: Duplicar ruta para Express
-- (Ajusta los IDs según tu caso)
INSERT INTO shipping_routes (destination_country_id, transit_hub_id, is_direct, is_active, route_name, origin_country, destination_country)
SELECT destination_country_id, transit_hub_id, is_direct, is_active, route_name || ' - Express', origin_country, destination_country
FROM shipping_routes WHERE id = 'ruta_original_id';

-- Luego actualiza el tier Express
UPDATE shipping_tiers SET route_id = 'nueva_ruta_id' 
WHERE tier_type = 'express' AND route_id = 'ruta_original_id';
```

---

## 🎨 PROBAR FRONTEND

1. Admin → Logística → Rutas → Editar nombre ✅
2. Admin → Logística → Tipos → Crear con transport_type ✅
3. Intentar agregar segundo tier a misma ruta → Debe advertir ⚠️

---

## 📚 DOCUMENTACIÓN COMPLETA

Ver archivos:
- `CAMBIOS_TRANSPORT_TYPE_COMPLETO.md`
- `RESUMEN_NOMBRES_RUTAS_Y_UN_TIER.md`
- `EXPLICACION_SHIPPING_TIERS.sql`

---

## ✅ CHECKLIST

- [ ] Ejecutar 3 SQL scripts en orden
- [ ] Resolver conflictos si existen
- [ ] Verificar columnas nuevas
- [ ] Probar editar nombres de rutas
- [ ] Probar seleccionar transport type
- [ ] Confirmar restricción de un tier por ruta

**¡Listo!** 🚀
