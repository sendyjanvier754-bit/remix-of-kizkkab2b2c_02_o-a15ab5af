# 🔧 Error al Crear Tipo de Envío - SOLUCIÓN

## 🐛 Problema Detectado
```
Error al guardar tipo de envío
Could not find the 'route_id' column of 'shipping_tiers' in the schema cache
```

## 🎯 Causa Raíz
La tabla `shipping_tiers` tiene la columna con nombre **`shipping_route_id`** pero el código frontend está enviando **`route_id`**.

Esto se debe a una inconsistencia entre migraciones antiguas y nuevas.

## ✅ Solución Inmediata

### Opción 1: Ejecutar SQL en Supabase (RECOMENDADO)

1. Ve al **SQL Editor** de Supabase
2. Ejecuta el archivo: `FIX_SHIPPING_TIERS_AHORA.sql`
3. O copia y pega este código:

```sql
ALTER TABLE public.shipping_tiers 
RENAME COLUMN shipping_route_id TO route_id;

DROP INDEX IF EXISTS public.idx_shipping_tiers_route;
CREATE INDEX idx_shipping_tiers_route_id 
ON public.shipping_tiers(route_id, tier_type);
```

4. Presiona **Run**
5. ¡Listo! Ahora podrás crear tipos de envío sin errores

### Opción 2: Aplicar Migración Completa

Si prefieres una solución más robusta, ejecuta:

```bash
supabase db push
```

Esto aplicará la migración `20260216_fix_shipping_tiers_column_name.sql` que incluye validaciones y rollback seguro.

## 🔍 Verificación

Después de aplicar la solución, verifica que la columna se renombró correctamente:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipping_tiers'
  AND column_name LIKE '%route%';
```

Deberías ver **`route_id`** en lugar de `shipping_route_id`.

## 📝 Notas Técnicas

- **Archivos modificados**: Ninguno (solo cambio en BD)
- **Impacto**: Bajo (solo renombra columna)
- **Compatibilidad**: El código frontend ya usa `route_id`
- **Rollback**: Renombrar de vuelta si es necesario

## ✨ Después de la Solución

Una vez aplicado el fix, podrás:
- Crear nuevos tipos de envío (Standard/Express)
- Editar tipos existentes
- Configurar rutas logísticas sin errores
