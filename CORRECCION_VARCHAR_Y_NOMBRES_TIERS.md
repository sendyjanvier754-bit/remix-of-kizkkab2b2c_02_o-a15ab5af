# Corrección de Límite VARCHAR y Nombres Personalizados para Tipos de Envío

## Problema Reportado

1. **Error al actualizar ruta:** "value too long for type character varying(100)"
   - Los campos `route_name`, `origin_country`, `destination_country` estaban limitados a 100 caracteres
   
2. **Falta de campos de nombre en tipos de envío:** 
   - Los cambios de nombres personalizados solo se implementaron en rutas (`shipping_routes`)
   - Los tipos de envío (`shipping_tiers`) también necesitaban estos campos

## Soluciones Implementadas

### 1. ✅ Corregir Límite de Caracteres en Rutas

**Archivo:** `ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql`

**Cambio:**
```sql
-- ANTES: VARCHAR(100)
ALTER TABLE public.shipping_routes
ADD COLUMN IF NOT EXISTS route_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS origin_country VARCHAR(100) DEFAULT 'China',
ADD COLUMN IF NOT EXISTS destination_country VARCHAR(100);

-- DESPUÉS: VARCHAR(255)
ALTER TABLE public.shipping_routes
ADD COLUMN IF NOT EXISTS route_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS origin_country VARCHAR(255) DEFAULT 'China',
ADD COLUMN IF NOT EXISTS destination_country VARCHAR(255);
```

**Beneficio:** Nombres más largos y descriptivos sin error de truncamiento.

---

### 2. ✅ Agregar Nombres Personalizados a Tipos de Envío

**Nuevo Archivo SQL:** `ADD_CUSTOM_NAMES_TO_SHIPPING_TIERS.sql`

**Campos agregados a `shipping_tiers`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `custom_tier_name` | VARCHAR(255) | Nombre completo personalizado del tier |
| `tier_origin_country` | VARCHAR(255) | País de origen del tier |
| `tier_destination_country` | VARCHAR(255) | País de destino del tier |

**Ejemplo de datos autogenerados:**
```sql
-- Para un tier Express Aéreo hacia Haití:
custom_tier_name = "Express aereo - China → Haiti"
tier_origin_country = "China"
tier_destination_country = "Haiti"
```

**SQL ejecuta:**
1. Agrega las 3 columnas nuevas
2. Genera nombres automáticos basados en rutas asociadas
3. Copia origen/destino de la ruta al tier
4. Maneja tiers sin ruta asociada

---

### 3. ✅ Actualizar Interfaz TypeScript

**Archivo:** `src/types/b2b-shipping.ts`

**Interfaz ShippingTier actualizada:**
```typescript
export interface ShippingTier {
  id: string;
  route_id: string;
  tier_type: 'standard' | 'express';
  tier_name: string;
  tier_description?: string;
  transport_type: 'maritimo' | 'aereo' | 'terrestre';
  
  // ✅ NUEVOS CAMPOS
  custom_tier_name?: string | null;
  tier_origin_country?: string | null;
  tier_destination_country?: string | null;
  
  // ... resto de campos
}
```

---

### 4. ✅ Actualizar Formulario de Tipos de Envío

**Archivo:** `src/pages/admin/AdminLogisticaRutas.tsx`

#### 4.1. Estado del Formulario

**Antes:**
```typescript
const [formData, setFormData] = useState({
  route_id: tier?.route_id || '',
  tier_type: tier?.tier_type || ('standard' as 'standard' | 'express'),
  tier_name: tier?.tier_name || '',
  transport_type: tier?.transport_type || ('aereo' as 'maritimo' | 'aereo' | 'terrestre'),
  // ... datos de costos
});
```

**Después:**
```typescript
const [formData, setFormData] = useState({
  route_id: tier?.route_id || '',
  tier_type: tier?.tier_type || ('standard' as 'standard' | 'express'),
  tier_name: tier?.tier_name || '',
  
  // ✅ NUEVOS CAMPOS
  custom_tier_name: tier?.custom_tier_name || '',
  tier_origin_country: tier?.tier_origin_country || 'China',
  tier_destination_country: tier?.tier_destination_country || '',
  
  transport_type: tier?.transport_type || ('aereo' as 'maritimo' | 'aereo' | 'terrestre'),
  // ... datos de costos
});
```

#### 4.2. Campos en el Formulario

Se agregó una nueva sección después del campo "Nombre del Servicio":

```tsx
{/* Campos de personalización adicionales */}
<div className="space-y-4 border rounded-lg p-4 bg-muted/50">
  <h4 className="font-medium text-sm">Personalización del Nombre (Opcional)</h4>
  
  {/* Nombre Completo Personalizado */}
  <div>
    <Label>Nombre Completo Personalizado</Label>
    <Input
      value={formData.custom_tier_name}
      onChange={(e) => setFormData({ ...formData, custom_tier_name: e.target.value })}
      placeholder="Ej: Express Aéreo China - Haití"
    />
  </div>

  {/* País Origen y Destino */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <Label>País Origen</Label>
      <Input value={formData.tier_origin_country} />
    </div>
    <div>
      <Label>País Destino</Label>
      <Input value={formData.tier_destination_country} />
    </div>
  </div>
</div>
```

---

## Estructura de Datos Actualizada

### shipping_routes
```
- route_name: VARCHAR(255)         ✅ AMPLIADO
- origin_country: VARCHAR(255)     ✅ AMPLIADO
- destination_country: VARCHAR(255) ✅ AMPLIADO
```

### shipping_tiers
```
- tier_name: VARCHAR (existente)
- custom_tier_name: VARCHAR(255)         ✅ NUEVO
- tier_origin_country: VARCHAR(255)      ✅ NUEVO
- tier_destination_country: VARCHAR(255) ✅ NUEVO
```

---

## Comparación: Antes vs Después

### ANTES ❌

**Rutas:**
- ✅ Campos de nombre implementados
- ❌ Límite de 100 caracteres causaba error

**Tipos de Envío:**
- ❌ Sin campos de personalización
- ❌ Solo tier_name básico

**Frontend:**
- ✅ Modal de edición de rutas con campos
- ❌ Modal de tipos de envío sin personalización

---

### DESPUÉS ✅

**Rutas:**
- ✅ Campos de nombre implementados
- ✅ Límite de 255 caracteres (amplio)

**Tipos de Envío:**
- ✅ custom_tier_name para nombre completo
- ✅ tier_origin_country
- ✅ tier_destination_country

**Frontend:**
- ✅ Modal de edición de rutas con campos (255 chars)
- ✅ Modal de tipos de envío con personalización completa
- ✅ Sección organizada con campos opcionales

---

## Flujo de Uso

### Crear/Editar Ruta

1. Usuario abre modal "Editar Ruta de Envío"
2. Completa:
   - **Nombre de la Ruta:** "China - Haití Express"
   - **País Origen:** "China"
   - **País Destino (Texto):** "Haití"
3. Guarda: datos se almacenan con límite de 255 chars

### Crear/Editar Tipo de Envío

1. Usuario abre modal "Nuevo Tipo de Envío"
2. Selecciona ruta
3. Completa campos básicos:
   - Tipo: Express
   - Transporte: Aéreo
   - Nombre del Servicio: "Express - Prioritario"
4. **Opcionalmente** completa personalización:
   - **Nombre Completo:** "Express Aéreo China - Haití"
   - **País Origen:** "China"
   - **País Destino:** "Haití"
5. Guarda: todos los campos se almacenan en BD

---

## Scripts SQL a Ejecutar

### 1. Actualizar `shipping_routes` (Ya ejecutado, pero con corrección)

```sql
-- Ejecutar el SQL actualizado: ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql
-- Ya corregido con VARCHAR(255)
```

### 2. Agregar campos a `shipping_tiers` (Nuevo)

```sql
-- Ejecutar: ADD_CUSTOM_NAMES_TO_SHIPPING_TIERS.sql
-- Agrega custom_tier_name, tier_origin_country, tier_destination_country
```

---

## Verificación

### En Base de Datos

```sql
-- 1. Verificar límite de caracteres en shipping_routes
SELECT 
  column_name, 
  character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'shipping_routes' 
  AND column_name IN ('route_name', 'origin_country', 'destination_country');

-- Resultado esperado: character_maximum_length = 255

-- 2. Verificar nuevos campos en shipping_tiers
SELECT 
  column_name, 
  data_type,
  character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'shipping_tiers' 
  AND column_name IN ('custom_tier_name', 'tier_origin_country', 'tier_destination_country');

-- Resultado esperado: 3 filas con VARCHAR(255)

-- 3. Ver datos de ejemplo
SELECT 
  tier_name,
  custom_tier_name,
  tier_origin_country,
  tier_destination_country
FROM shipping_tiers
LIMIT 5;
```

### En Frontend

1. **Rutas:**
   - Abrir modal de editar ruta
   - Verificar que los campos acepten texto largo (>100 chars)
   - Guardar sin error

2. **Tipos de Envío:**
   - Abrir modal de nuevo tipo de envío
   - Verificar sección "Personalización del Nombre (Opcional)"
   - Completar campos personalizados
   - Guardar y verificar que se guarden en BD

---

## Resumen de Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql` | VARCHAR(100) → VARCHAR(255) |
| `ADD_CUSTOM_NAMES_TO_SHIPPING_TIERS.sql` | ✅ Nuevo archivo SQL |
| `src/types/b2b-shipping.ts` | Agregados 3 campos a ShippingTier |
| `src/pages/admin/AdminLogisticaRutas.tsx` | Estado y UI actualizado |

---

## Estado Final

✅ **Rutas:** Nombres personalizados con límite ampliado (255 chars)
✅ **Tipos de Envío:** Nombres personalizados completos con origen/destino
✅ **Frontend:** Formularios actualizados sin errores TypeScript
✅ **Base de Datos:** Estructura lista para ejecutar SQL
✅ **Coherencia:** Ambas tablas (rutas y tiers) con misma capacidad de personalización

---

## Próximos Pasos

1. ✅ Ejecutar `ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql` actualizado
2. ✅ Ejecutar `ADD_CUSTOM_NAMES_TO_SHIPPING_TIERS.sql` nuevo
3. ✅ Verificar con las queries de verificación
4. ✅ Probar edición de rutas con nombres largos
5. ✅ Probar creación de tipos de envío con personalización
6. ✅ Confirmar que todo funciona sin errores
