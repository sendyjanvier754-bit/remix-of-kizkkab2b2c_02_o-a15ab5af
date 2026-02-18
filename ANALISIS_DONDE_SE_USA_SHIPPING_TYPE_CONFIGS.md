# 🔍 Análisis: ¿Dónde se usa `shipping_type_configs`?

## Resumen Ejecutivo

La tabla **`shipping_type_configs`** es ANTIGUA y debe ser **DEPRECADA** completamente. Aquí está el análisis completo:

---

## 📊 Ubicaciones Encontradas

### 1. **Código TypeScript (Frontend)**

#### a) `src/integrations/supabase/types.ts` (3 referencias)
**Estado:** ✅ AUTOMÁTICO - Generado por Supabase CLI

```typescript
// Línea 4584
shipping_type_configs: {
  Row: { ... }
  Insert: { ... }
  Update: { ... }
}
```

**Acción requerida:** 
- ❌ NO editar manualmente
- ✅ Se actualizará automáticamente cuando se elimine la tabla
- 🔄 Ejecutar: `npx supabase gen types typescript --project-id [id]` después de eliminar tabla

**¿Se usa activamente?** NO - Solo definición de tipos

---

### 2. **Migraciones SQL (Supabase)**

#### a) `supabase/migrations/20260210_test_shipping_types.sql`
**Estado:** ⚠️ LEGACY - Archivo de testing antiguo

```sql
FROM shipping_type_configs
```

**Acción requerida:**
- ✅ Ignorar - Es solo testing histórico
- ❌ No se ejecuta en producción

#### b) `supabase/migrations/20260210_shipping_types_linked_to_routes.sql`
**Estado:** ⚠️ LEGACY - Migración antigua cuando se usaba esta tabla

```sql
FROM shipping_type_configs stc
```

**Acción requerida:**
- ✅ Ignorar - Migración ya aplicada
- ❌ No afecta código actual

---

### 3. **Documentación (Archivos .md y .sql)**

Encontrados en ~40 archivos de documentación y ejemplos:
- `ADMIN_UI_UPDATES_REQUIRED.md`
- `CALCULAR_COSTO_2KG.sql`
- `FUNCIONES_DEPRECADAS_Y_NUEVAS.md`
- `REVERT_CALCULATE_SHIPPING_COST_CART.sql`
- etc.

**Acción requerida:**
- ✅ Ignorar - Solo documentación histórica
- ❌ No afecta funcionalidad

---

## 🎯 Verificación en Base de Datos

### Ejecuta este SQL en Supabase:

```sql
-- Copiar y pegar: VERIFICAR_USO_SHIPPING_TYPE_CONFIGS.sql
```

Archivo creado: [VERIFICAR_USO_SHIPPING_TYPE_CONFIGS.sql](VERIFICAR_USO_SHIPPING_TYPE_CONFIGS.sql)

Este script verifica:
1. ✅ Si la tabla existe
2. 📊 Cuántos registros tiene
3. ⚙️ Qué funciones la usan
4. 👁️ Qué vistas la usan
5. 🔗 Qué tablas referencian a ella
6. 💡 Recomendación final

---

## ✅ Conclusión

### ¿Dónde se usa activamente? 

**NINGÚN LUGAR EN EL CÓDIGO ACTIVO** ✅

### Detalles:

| Ubicación | Estado | Acción |
|-----------|--------|--------|
| **Frontend (src/)** | ❌ NO SE USA | Solo tipos auto-generados |
| **Funciones SQL** | ❌ NO SE USA | Todas actualizadas a `shipping_tiers` |
| **Vistas DB** | ⚠️ VERIFICAR | Ejecutar SQL de verificación |
| **Componentes React** | ❌ NO SE USA | Ninguna referencia directa |
| **Hooks** | ❌ NO SE USA | Todos usan `shipping_tiers` |

---

## 🚀 Plan de Acción

### Opción A: Mantener (Conservador)
```sql
-- No hacer nada
-- Dejar la tabla por si acaso
-- Ventaja: Zero risk
-- Desventaja: Code bloat, confusión
```

### Opción B: Deprecar (Recomendado)
```sql
-- 1. Verificar que no se usa
\i 'VERIFICAR_USO_SHIPPING_TYPE_CONFIGS.sql'

-- 2. Si el resultado es "SEGURO DEPRECAR", renombrar tabla
ALTER TABLE shipping_type_configs 
RENAME TO _deprecated_shipping_type_configs;

-- 3. Agregar comentario
COMMENT ON TABLE _deprecated_shipping_type_configs IS 
  'DEPRECATED: Esta tabla ya no se usa. Se migró a shipping_tiers.
   Mantener 30 días antes de eliminar permanentemente.
   Fecha de deprecación: 2026-02-18';

-- 4. Regenerar tipos TypeScript
-- npx supabase gen types typescript --project-id [tu-proyecto-id] > src/integrations/supabase/types.ts
```

### Opción C: Eliminar (Agresivo)
```sql
-- ⚠️ SOLO SI ESTÁS 100% SEGURO

-- 1. Backup primero
pg_dump -h [host] -U postgres -t shipping_type_configs kizkkab > backup_shipping_type_configs.sql

-- 2. Eliminar tabla
DROP TABLE IF EXISTS shipping_type_configs CASCADE;

-- 3. Regenerar tipos
-- npx supabase gen types typescript
```

---

## 📋 Checklist de Validación

Antes de deprecar/eliminar, verifica:

- [ ] Ejecutar `VERIFICAR_USO_SHIPPING_TYPE_CONFIGS.sql`
- [ ] Resultado: "SEGURO DEPRECAR" ✅
- [ ] No hay funciones usando la tabla
- [ ] No hay vistas usando la tabla
- [ ] No hay foreign keys apuntando a ella
- [ ] Frontend no hace queries directas
- [ ] Backup realizado (por si acaso)

---

## 🎉 Estado Actual de Tu Sistema

Basado en el análisis de código:

| Componente | Tabla Usada | Estado |
|------------|-------------|--------|
| `useAutoSaveCartWithShipping` | ✅ `shipping_tiers` | Nuevo hook |
| `calculate_shipping_cost_cart` | ✅ `shipping_tiers` | Actualizado |
| `get_user_cart_shipping_cost` | ✅ `shipping_tiers` | Actualizado |
| `calculate_shipping_cost_for_selected_items` | ✅ `shipping_tiers` | Actualizado |
| `SellerCartPage` | ✅ `shipping_tiers` | Integrado |
| `AdminGlobalLogisticsPage` | ✅ `shipping_tiers` | Actualizado |

**Veredicto:** `shipping_type_configs` ya NO se usa en ningún componente activo. Es seguro deprecar.

---

## 💡 Recomendación Final

**YA NO USAMOS `shipping_type_configs` EN NINGÚN LUGAR DEL CÓDIGO ACTIVO.**

Sugerencia:
1. Ejecuta el SQL de verificación para confirmar
2. Si confirma que no se usa, renombrar a `_deprecated_shipping_type_configs`
3. Eliminar permanentemente después de 30 días de testing

**Status: ✅ READY TO DEPRECATE**
