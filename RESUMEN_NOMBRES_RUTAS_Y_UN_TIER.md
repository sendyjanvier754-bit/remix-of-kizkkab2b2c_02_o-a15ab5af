# ✅ RESUMEN COMPLETO: NOMBRES DE RUTAS Y UN TIER POR RUTA

## 📅 Fecha: 16 Febrero 2026

## 🎯 Cambios Implementados

### 1. NOMBRES PERSONALIZADOS PARA RUTAS ✅
**Problema:** Las rutas no tenían nombres editables, solo IDs
**Solución:** Agregar columnas para nombres personalizados

#### Base de Datos
```sql
ALTER TABLE public.shipping_routes
ADD COLUMN route_name VARCHAR(100),
ADD COLUMN origin_country VARCHAR(100) DEFAULT 'China',
ADD COLUMN destination_country VARCHAR(100);
```

#### Frontend
- ✅ Formulario para editar `route_name`, `origin_country`, `destination_country`
- ✅ Placeholders descriptivos
- ✅ Helper text para guiar al usuario
- ✅ Valores por defecto: origin_country = "China"

---

### 2. RESTRICCIÓN: UNA RUTA = UN TIER ✅
**Problema:** Una ruta podía tener múltiples tiers (Standard Y Express)
**Solución:** Constraint UNIQUE para permitir solo UN tier por ruta

#### Base de Datos
```sql
-- Eliminar constraint anterior
ALTER TABLE public.shipping_tiers 
DROP CONSTRAINT IF EXISTS unique_route_tier;

-- Nuevo constraint: UN tier por ruta
ALTER TABLE public.shipping_tiers
ADD CONSTRAINT unique_one_tier_per_route UNIQUE(route_id);
```

#### Frontend
- ✅ Advertencia visual cuando se selecciona ruta que ya tiene tier
- ✅ Deshabilitar rutas que ya tienen tier en el selector
- ✅ Mostrar "⚠️ Ya tiene tier" en rutas ocupadas
- ✅ Mensaje de confirmación: "Si guardas, reemplazarás el anterior"

---

## 📊 ARCHIVOS MODIFICADOS

### SQL
1. **ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql**
   - ✅ Corregido: `st.route_id` en lugar de `st.shipping_route_id`

2. **ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql** (NUEVO)
   - Agrega columnas route_name, origin_country, destination_country
   - Genera nombres automáticos para rutas existentes
   - Agrega constraint UNIQUE(route_id) en shipping_tiers
   - Incluye queries de verificación de conflictos

### Frontend
1. **src/pages/admin/AdminLogisticaRutas.tsx**
   - ✅ RouteForm actualizado:
     - Default origin_country: "China" (en lugar de "CN")
     - Placeholder más descriptivo: "Ej: Envío Express a Haití..."
     - Helper text explicativo
     - Advertencia sobre restricción de un tier por ruta
   
   - ✅ TierForm actualizado:
     - Nuevo prop `allTiers` para validación
     - Verificación si ruta ya tiene tier asignado
     - Deshabilitar rutas ocupadas en selector
     - Mostrar advertencia naranja si ruta tiene tier
     - Mostrar checkmark verde si ruta está disponible

---

## 🚀 PASOS PARA APLICAR

### 1. Ejecutar SQL (en orden)
```bash
# 1. Corregir transport_type en shipping_tiers
psql -f ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql

# 2. Agregar nombres y restricción de un tier por ruta
psql -f ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql
```

### 2. Verificar Conflictos
Después de ejecutar el SQL, verifica si hay rutas con múltiples tiers:
```sql
SELECT 
  sr.id as route_id,
  sr.route_name,
  COUNT(st.id) as cantidad_tiers,
  string_agg(st.tier_type || ' (' || st.transport_type || ')', ', ') as tiers
FROM public.shipping_routes sr
JOIN public.shipping_tiers st ON sr.id = st.route_id
GROUP BY sr.id, sr.route_name
HAVING COUNT(st.id) > 1;
```

### 3. Resolver Conflictos (si existen)

#### Opción A: Duplicar rutas (Recomendado)
Para cada ruta con múltiples tiers, crea una nueva ruta para el segundo tier:

```sql
-- Ejemplo: Ruta "China → Haití" tiene Standard Y Express
-- 1. Crear nueva ruta para Express
INSERT INTO public.shipping_routes (
  destination_country_id, 
  transit_hub_id, 
  is_direct, 
  is_active,
  route_name,
  origin_country,
  destination_country
)
SELECT 
  destination_country_id,
  transit_hub_id,
  is_direct,
  is_active,
  route_name || ' - Express',
  origin_country,
  destination_country
FROM public.shipping_routes
WHERE id = 'RUTA_ORIGINAL_ID'
RETURNING id; -- Guarda este ID

-- 2. Actualizar tier Express para usar nueva ruta
UPDATE public.shipping_tiers
SET route_id = 'NUEVA_RUTA_ID'
WHERE tier_type = 'express' AND route_id = 'RUTA_ORIGINAL_ID';
```

#### Opción B: Eliminar tiers extra
Si solo necesitas un tier por ruta, elimina los demás:

```sql
-- Mantener solo Standard
DELETE FROM public.shipping_tiers
WHERE tier_type = 'express' AND route_id = 'RUTA_ID';
```

### 4. Probar en Frontend
1. Ve a Admin → Logística Global → Rutas de Envío
2. Edita una ruta → Verifica que puedes cambiar el nombre
3. Ve a Tipos de Envío → Intenta crear nuevo tier
4. Selecciona una ruta que ya tiene tier → Verifica advertencia naranja
5. Selecciona ruta sin tier → Verifica checkmark verde
6. Guarda y confirma que funciona correctamente

---

## 📋 VALIDACIONES IMPLEMENTADAS

### En RouteForm
- ✅ Campo `route_name` es requerido
- ✅ Advertencia: "Solo puede haber un tier por ruta"
- ✅ Helper text descriptivo en cada campo

### En TierForm
- ✅ Deshabilita rutas que ya tienen tier (excepto la del tier actual si estamos editando)
- ✅ Muestra "⚠️ Ya tiene tier" en rutas ocupadas
- ✅ Advertencia naranja al seleccionar ruta ocupada:
  ```
  ⚠️ Advertencia: Esta ruta ya tiene un tipo de envío configurado: Standard
  Solo se permite un tipo de envío por ruta. Si guardas, reemplazarás el anterior.
  ```
- ✅ Checkmark verde "✓ Esta ruta está disponible" para rutas libres

---

## 🎨 EJEMPLOS DE USO

### Crear nueva ruta
1. Click "Nueva Ruta"
2. Nombre: "Envío Express a Haití"
3. Origen: "China"
4. Destino: "Haití"
5. Guardar

### Crear tier para la ruta
1. Click "Nuevo Tipo de Envío"
2. Seleccionar ruta: "Envío Express a Haití" (✓ disponible)
3. Tipo: Express
4. Transporte: Aéreo ✈️
5. Configurar costos y tiempos
6. Guardar

### Si necesitas Standard Y Express
1. Crear ruta: "Envío Standard a Haití"
2. Crear tier Standard para esa ruta
3. Crear otra ruta: "Envío Express a Haití"
4. Crear tier Express para la segunda ruta

---

## ⚠️ IMPORTANTE

### Antes del cambio
- ✅ Una ruta podía tener múltiples tiers (Standard, Express, etc.)
- ❌ Confuso para gestionar
- ❌ Duplicación innecesaria

### Después del cambio
- ✅ Una ruta = Un tier único
- ✅ Nombres descriptivos personalizables
- ✅ Más claro y fácil de gestionar
- ✅ Si necesitas Standard Y Express, creas 2 rutas diferentes

---

## 🔍 QUERIES ÚTILES

### Ver todas las rutas con sus tiers
```sql
SELECT 
  sr.route_name,
  sr.origin_country || ' → ' || sr.destination_country as ruta,
  st.tier_type,
  st.transport_type,
  st.tier_name,
  st.is_active
FROM public.shipping_routes sr
LEFT JOIN public.shipping_tiers st ON sr.id = st.route_id
ORDER BY sr.route_name;
```

### Identificar rutas sin tier
```sql
SELECT 
  sr.route_name,
  sr.origin_country || ' → ' || sr.destination_country as ruta,
  'Sin tier configurado' as estado
FROM public.shipping_routes sr
LEFT JOIN public.shipping_tiers st ON sr.id = st.route_id
WHERE st.id IS NULL
ORDER BY sr.route_name;
```

### Contar tiers por ruta
```sql
SELECT 
  sr.route_name,
  COUNT(st.id) as cantidad_tiers,
  CASE 
    WHEN COUNT(st.id) = 0 THEN '❌ Sin configurar'
    WHEN COUNT(st.id) = 1 THEN '✅ Correcto'
    WHEN COUNT(st.id) > 1 THEN '⚠️ Conflicto'
  END as estado
FROM public.shipping_routes sr
LEFT JOIN public.shipping_tiers st ON sr.id = st.route_id
GROUP BY sr.id, sr.route_name
ORDER BY cantidad_tiers DESC, sr.route_name;
```

---

## ✅ CHECKLIST FINAL

### Base de Datos
- [ ] Ejecutar ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql
- [ ] Ejecutar ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql
- [ ] Verificar conflictos (rutas con múltiples tiers)
- [ ] Resolver conflictos (duplicar rutas o eliminar tiers extra)
- [ ] Confirmar constraint UNIQUE(route_id) activo

### Frontend
- [ ] Verificar que RouteForm permite editar nombres
- [ ] Verificar placeholders y helper text
- [ ] Verificar TierForm muestra advertencias correctamente
- [ ] Probar crear tier en ruta sin tier (debe funcionar)
- [ ] Probar crear tier en ruta con tier (debe advertir)
- [ ] Confirmar UI muestra estado correcto (verde/naranja)

### Funcionalidad
- [ ] Crear nueva ruta con nombre personalizado
- [ ] Editar nombre de ruta existente
- [ ] Crear tier para ruta sin tier
- [ ] Intentar crear segundo tier en misma ruta (debe bloquear/advertir)
- [ ] Editar tier existente (debe permitir mantener misma ruta)
- [ ] Verificar que todo se guarda correctamente en DB

---

## 📞 SOPORTE

Si encuentras problemas:
1. Verifica logs de Supabase para errores SQL
2. Revisa console del navegador para errores frontend
3. Confirma que las columnas existen: `route_name`, `origin_country`, `destination_country`
4. Verifica constraint: `unique_one_tier_per_route`

---

## 🎉 RESULTADO FINAL

✅ Rutas con nombres descriptivos y editables
✅ Un tier único por ruta (más simple y claro)
✅ Validaciones visuales en el frontend
✅ Base de datos con constraints que previenen errores
✅ Mejor UX para administradores
