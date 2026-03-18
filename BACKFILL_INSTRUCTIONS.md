# 🚀 Instrucciones de Backfill de Traducciones

## Estado Actual del Sistema

✅ **Completado:**
- Migración de BD aplicada (`source_text`, `source_text_hash` agregados)
- 11 componentes React con hooks de traducción integrados
- Edge functions listos (`translate-content` + `backfill-translations`)
- Validación TypeScript sin errores

## 📋 Próios Pasos: Ejecutar Backfill

El sistema de traducción está completo y listo. Ahora necesitas ejecutar el **backfill** para traducir el contenido existente.

### Opción 1: Dry-Run (Recomendado Primero)
```bash
# Verificar cuántos registros se van a traducir sin hacer cambios
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/backfill-translations \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "product",
    "limit": 50,
    "offset": 0,
    "language_targets": ["en", "fr", "ht"],
    "dry_run": true
  }'
```

### Opción 2: Ejecutar Backfill Real (Después de Verificar Dry-Run)
```bash
# Traducir los primeros 50 productos
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/backfill-translations \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "product",
    "limit": 50,
    "offset": 0,
    "language_targets": ["en", "fr", "ht"],
    "dry_run": false
  }'
```

### Opción 3: Traducir Todo (Sin Límite)
```bash
# Traducir todos los productos, categorías, banners, etc.
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/backfill-translations \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "all",
    "language_targets": ["en", "fr", "ht"],
    "dry_run": false
  }'
```

## 🎯 Entidades que se Traducirán

1. **products** - Nombre, descripción corta, descripción larga
2. **categories** - Nombre y descripción
3. **admin_banners** - Título y descripción
4. **countries** - Nombre
5. **departments** - Nombre
6. **communes** - Nombre

## ⚙️ Parámetros del Backfill

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `entity_type` | string | `product`, `category`, `banner`, `country`, `department`, `commune`, o `all` |
| `limit` | number | Máximo de registros a procesar (default: 100) |
| `offset` | number | Saltar N registros (para paginar) |
| `language_targets` | string[] | Idiomas destino: `en`, `fr`, `ht` |
| `dry_run` | boolean | Si es `true`, no guarda cambios (solo preview) |

## 📊 Respuesta Esperada

```json
{
  "success": true,
  "backfill_completed": true,
  "summary": {
    "total_rows": 50,
    "translated_rows": 48,
    "skipped_rows": 2,
    "errors": 0,
    "translations_by_language": {
      "en": 48,
      "fr": 48,
      "ht": 48
    }
  },
  "details": {
    "product": {
      "total": 50,
      "inserted_or_updated": 48,
      "skipped": 2
    }
  }
}
```

## 🔄 Próximos Pasos Después del Backfill

1. ✅ Verificar respuesta del backfill
2. ✅ Cambiar idioma a `en`/`fr`/`ht` en la UI
3. ✅ Verificar que los productos/categorías aparecen traducidos
4. ✅ Monitorear logs de Supabase para errores

## 📝 Notas

- **Hash Validation**: El backfill automáticamente detecta si el contenido ya fue traducido (por hash)
- **Incremental**: Puedes ejecutar el backfill múltiples veces sin duplicar traducciones
- **Non-Blocking**: El backfill es asíncrono - no bloquea la UI
- **Fallback**: Si una traducción falla, la UI sigue mostrando el original en español

## 🚀 Para Ejecutar Localmente (Desarrollo)

Si estás en desarrollo local y necesitas acceso directo al edge function:

```bash
# Primero obtén tu token de Supabase (desde anon/service role)
# Luego ejecuta curl o usa Postman/Insomnia

# O desde Node.js:
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data, error } = await supabase.functions.invoke('backfill-translations', {
  body: {
    entity_type: 'product',
    limit: 50,
    offset: 0,
    language_targets: ['en', 'fr', 'ht'],
    dry_run: true
  }
})

console.log(data, error)
```

---

**Próximo paso**: Ejecuta el dry-run para verificar que todo funciona correctamente. 🎉
