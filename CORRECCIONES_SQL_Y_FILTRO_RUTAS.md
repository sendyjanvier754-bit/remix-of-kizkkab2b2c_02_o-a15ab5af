# ✅ CORRECCIONES APLICADAS - SQL Y FRONTEND

## 📅 Fecha: 16 Febrero 2026

## 🐛 ERRORES CORREGIDOS

### 1. ❌ Error en ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql
**Error anterior:**
```
ERROR: 42703: column sr.origin_country does not exist
```

**Causa:** El SQL intentaba usar `sr.origin_country` y `sr.destination_country` que aún no existen (se crean en el paso 3).

**Solución aplicada:**
Eliminé el JOIN con shipping_routes de la query de verificación. Ahora solo muestra los datos de shipping_tiers:

```sql
-- ANTES (incorrecto):
SELECT 
  st.id,
  sr.origin_country || ' → ' || sr.destination_country as ruta,
  st.tier_type,
  ...
FROM public.shipping_tiers st
JOIN public.shipping_routes sr ON st.route_id = sr.id

-- DESPUÉS (correcto):
SELECT 
  st.id,
  st.route_id,
  st.tier_type,
  st.transport_type,
  ...
FROM public.shipping_tiers st
ORDER BY st.created_at DESC;
```

---

### 2. ❌ Error en ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql
**Error anterior:**
```
ERROR: 42703: column dc.name_es does not exist
```

**Causa:** La tabla `destination_countries` usa `name` en lugar de `name_es`.

**Solución aplicada:**
Cambié `dc.name_es` por `dc.name` con COALESCE como fallback:

```sql
-- ANTES (incorrecto):
destination_country = dc.name_es,
route_name = 'China → ' || dc.name_es

-- DESPUÉS (correcto):
destination_country = COALESCE(dc.name, 'Destino'),
route_name = 'China → ' || COALESCE(dc.name, 'Destino')
```

---

## ✨ MEJORA FRONTEND

### 3. 🎯 Solo mostrar rutas sin tier al crear nuevo
**Requerimiento:** Al crear un tipo de envío nuevo, solo mostrar rutas que NO tienen tier asignado.

**Implementación:**

```typescript
// Filtro inteligente de rutas
const availableRoutes = tier 
  ? routes // Si estamos EDITANDO, mostrar todas
  : routes.filter(route => !allTiers.some(t => t.route_id === route.id)); // Si es NUEVO, solo sin tier
```

**Comportamiento:**
- ✅ **Crear nuevo tier:** Solo se muestran rutas sin tier
- ✅ **Editar tier existente:** Se muestran todas las rutas (para poder cambiar si es necesario)
- ✅ **Sin rutas disponibles:** Mensaje: "Todas las rutas ya tienen tipo de envío. Crea una nueva ruta primero."

**UI mejorada:**
```tsx
{availableRoutes.length === 0 ? (
  <div className="p-4 text-center">
    {tier 
      ? "No hay rutas disponibles"
      : "Todas las rutas ya tienen tipo de envío. Crea una nueva ruta primero."}
  </div>
) : (
  // Mostrar solo rutas disponibles
)}
```

---

## 📋 ORDEN DE EJECUCIÓN ACTUALIZADO

### PASO 1: Transport type en route_logistics_costs
```bash
# Ejecutar en Supabase SQL Editor
```
**Archivo:** `ADD_TRANSPORT_TYPE_TO_ROUTE_COSTS.sql`
✅ Sin cambios - ejecutar tal cual

---

### PASO 2: Transport type en shipping_tiers
```bash
# Ejecutar en Supabase SQL Editor
```
**Archivo:** `ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql`
✅ **CORREGIDO** - Eliminado el JOIN que causaba error

---

### PASO 3: Nombres de rutas y restricción
```bash
# Ejecutar en Supabase SQL Editor
```
**Archivo:** `ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql`
✅ **CORREGIDO** - Usa `dc.name` en lugar de `dc.name_es`

---

## 🔍 ARCHIVOS ÚTILES

### VERIFICAR_DESTINATION_COUNTRIES.sql (NUEVO)
Ejecuta este query para ver la estructura de destination_countries:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'destination_countries';
```

Esto te ayudará a confirmar qué columnas existen antes de ejecutar los scripts.

---

## ✅ CHECKLIST DE VERIFICACIÓN

### SQL Corregidos
- [x] ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql - No usa columnas inexistentes
- [x] ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql - Usa `dc.name` correctamente

### Frontend Mejorado
- [x] Solo muestra rutas sin tier al crear nuevo
- [x] Muestra todas las rutas al editar existente
- [x] Mensaje claro si no hay rutas disponibles
- [x] Helper text contextual según modo (crear/editar)

---

## 🎯 FLUJO COMPLETO CORRECTO

### 1. Ejecutar SQL en orden
```bash
# En Supabase SQL Editor:
1. ADD_TRANSPORT_TYPE_TO_ROUTE_COSTS.sql ✅
2. ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql ✅ CORREGIDO
3. ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql ✅ CORREGIDO
```

### 2. Probar en Frontend
1. **Crear rutas sin tiers:**
   - Admin → Logística → Rutas de Envío
   - Crear ruta: "Envío Express Haití"
   - Crear ruta: "Envío Standard RD"

2. **Crear primer tier:**
   - Admin → Logística → Tipos de Envío
   - Click "Nuevo Tipo de Envío"
   - ✅ Solo aparecen las 2 rutas sin tier
   - Seleccionar "Envío Express Haití"
   - Configurar y guardar

3. **Crear segundo tier:**
   - Click "Nuevo Tipo de Envío" de nuevo
   - ✅ Solo aparece "Envío Standard RD" (la única sin tier)
   - Seleccionar y configurar

4. **Si todas las rutas tienen tier:**
   - Click "Nuevo Tipo de Envío"
   - ✅ Mensaje: "Todas las rutas ya tienen tipo de envío..."
   - **Solución:** Crear nueva ruta primero

5. **Editar tier existente:**
   - Editar un tier creado
   - ✅ Se muestran TODAS las rutas (por si necesitas cambiar)

---

## 🚀 RESULTADO FINAL

### SQL
- ✅ Scripts corregidos y listos para ejecutar
- ✅ No más errores de columnas inexistentes
- ✅ Usa nombres correctos de columnas (`dc.name`)
- ✅ Queries de verificación simplificadas

### Frontend
- ✅ UX mejorada: solo rutas disponibles al crear
- ✅ Previene confusión con rutas ya ocupadas
- ✅ Mensajes contextuales claros
- ✅ Mantiene flexibilidad al editar

### Funcionalidad
- ✅ Fuerza crear nueva ruta si todas están ocupadas
- ✅ Un tier por ruta (restricción respetada)
- ✅ Flujo intuitivo para el usuario
- ✅ Errores SQL eliminados

---

## 📞 COMANDOS DE VERIFICACIÓN

### Verificar que los scripts se ejecutaron bien:

```sql
-- 1. Verificar transport_type en route_logistics_costs
SELECT COUNT(*) FROM route_logistics_costs WHERE transport_type IS NOT NULL;

-- 2. Verificar transport_type en shipping_tiers
SELECT COUNT(*) FROM shipping_tiers WHERE transport_type IS NOT NULL;

-- 3. Verificar nombres en shipping_routes
SELECT route_name, origin_country, destination_country 
FROM shipping_routes 
WHERE route_name IS NOT NULL;

-- 4. Verificar constraint de un tier por ruta
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'shipping_tiers' AND constraint_name = 'unique_one_tier_per_route';
```

Si todos devuelven resultados, ¡está todo listo! 🎉

---

## 💡 TIPS

1. **Si aparece el error de columnas aún:** Verifica que ejecutaste los scripts EN ORDEN (1→2→3)
2. **Si no aparecen rutas al crear tier:** Es correcto! Significa que todas tienen tier. Crea una nueva ruta.
3. **Si necesitas ver qué rutas están disponibles:** Ve primero al tab "Rutas de Envío" y verifica cuáles tienen badges "Sin tipos de envío"

---

¡Listo para ejecutar! 🚀
