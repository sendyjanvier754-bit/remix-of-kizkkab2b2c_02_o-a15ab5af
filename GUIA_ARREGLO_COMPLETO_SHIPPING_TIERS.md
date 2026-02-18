# 🔧 GUÍA COMPLETA: Arreglar Error de Tipo de Envío

## 🚨 Problema
```
Error al guardar tipo de envío
Could not find the 'route_id' column of 'shipping_tiers' in the schema cache
```

## 📋 Causa Raíz
Hay **inconsistencia** entre el nombre de columna en diferentes partes:
- ❌ Base de datos: `shipping_route_id` 
- ✅ Código frontend: `route_id`
- ❌ Tipos Supabase: `shipping_route_id`

## ✅ SOLUCIÓN PASO A PASO

### PASO 1: Actualizar Base de Datos (CRÍTICO)

Ejecuta esto en el **SQL Editor de Supabase**:

```sql
-- Renombrar columna
ALTER TABLE public.shipping_tiers 
RENAME COLUMN shipping_route_id TO route_id;

-- Actualizar índice
DROP INDEX IF EXISTS idx_shipping_tiers_route;
CREATE INDEX idx_shipping_tiers_route_id 
ON public.shipping_tiers(route_id, tier_type);

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND column_name LIKE '%route%';
```

✅ Deberías ver `route_id` en los resultados.

### PASO 2: Regenerar Tipos de Supabase

En tu terminal, ejecuta:

```bash
# Regenerar tipos desde el esquema actualizado
supabase gen types typescript --local > src/integrations/supabase/types.ts

# O si usas proyecto remoto:
supabase gen types typescript --project-id [TU_PROJECT_ID] > src/integrations/supabase/types.ts
```

Esto actualizará automáticamente `src/integrations/supabase/types.ts` con el nuevo nombre de columna.

### PASO 3: Actualizar Hooks TypeScript

Busca y reemplaza `shipping_route_id` por `route_id` en estos archivos:

```typescript
// src/hooks/useShippingCostCalculationForCart.ts
- .eq('shipping_route_id', routeData.id)
+ .eq('route_id', routeData.id)

// src/hooks/useShippingTypes.ts  
- .eq('shipping_route_id', routeId)
+ .eq('route_id', routeId)

// src/hooks/useRoutePricing.ts
- (c) => c.shipping_route_id === route.id
+ (c) => c.route_id === route.id

// src/hooks/useProductsB2B.ts
- .filter(c => c.shipping_route_id === route.id)
+ .filter(c => c.route_id === route.id)
```

### PASO 4: Verificar Interfaces

Actualiza las interfaces si es necesario:

```typescript
// src/hooks/useShippingTypes.ts
export interface ShippingTypeConfig {
-  shipping_route_id: string;
+  route_id: string;
   // ... resto de campos
}
```

## 🧪 Probar la Solución

1. Reinicia el servidor de desarrollo (`npm run dev`)
2. Ve a **Admin → Logística Global** 
3. Haz clic en **"+ Nuevo Tipo"**
4. Selecciona una ruta
5. Llena el formulario
6. Presiona **"Guardar"**

✅ **Debería funcionar sin errores**

## 🔍 Archivos Afectados

### Base de Datos
- `shipping_tiers` tabla (columna renombrada)
- Índices actualizados

### TypeScript (requieren actualización manual)
- `src/integrations/supabase/types.ts` (regenerado)
- `src/hooks/useShippingCostCalculationForCart.ts`
- `src/hooks/useShippingTypes.ts`
- `src/hooks/useRoutePricing.ts`
- `src/hooks/useProductsB2B.ts`
- `src/hooks/useMarkets.ts`
- `src/hooks/useCountriesRoutes.ts`
- `src/hooks/useCoverageAlerts.ts`

## 📝 Notas Importantes

1. **Backup primero**: Haz backup de tu BD antes de ejecutar ALTER TABLE
2. **Producción**: Aplica cambios en desarrollo primero, luego en producción
3. **Caché**: Puede que necesites limpiar caché de Supabase
4. **Testing**: Prueba crear/editar tipos de envío después del cambio

## 🚀 Migración Automatizada (Opcional)

Si prefieres usar migraciones de Supabase:

```bash
supabase db push
```

Esto aplicará la migración `20260216_fix_shipping_tiers_column_name.sql`.

## ❓ Si Aún Tienes Problemas

1. Verifica que la columna se renombró correctamente en la BD
2. Regenera tipos de Supabase
3. Limpia caché del navegador (Ctrl+Shift+R)
4. Re inicia servidor frontend
5. Verifica logs de errores en consola del navegador

## ✨ Resultado Final

Después de completar todos los pasos:
- ✅ Columna `route_id` en la base de datos
- ✅ Tipos TypeScript actualizados
- ✅ Hooks usando `route_id` consistentemente
- ✅ Puedes crear tipos de envío sin errores
