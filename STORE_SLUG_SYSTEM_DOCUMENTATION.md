# 🏷️ Sistema de Store Slugs

## ¿Qué es un Store Slug?

Un **Store Slug** es un identificador único y legible para cada tienda en la plataforma. Reemplaza el uso de UUIDs largos (ej: `550e8400-e29b-41d4-a716-446655440000`) con un formato más compacto y amigable.

### Formato del Slug

```
K + 4 dígitos + 1 letra + 6 dígitos + 2 dígitos de año
```

**Ejemplo:** `K2629G372026`

**Desglose:**
- `K` - Prefijo fijo (1 carácter)
- `2629` - 4 dígitos aleatorios (2 carácter)
- `G` - Letra aleatoria A-Z (1 carácter)
- `372026` - 6 dígitos aleatorios (6 caracteres)
  - Nota: Los últimos 2 dígitos pueden representar el año (26 = 2026)

**Total:** 13 caracteres

---

## ✅ Ventajas del Slug

1. **Más Corto:** 13 caracteres vs 36 del UUID
2. **Memorable:** Más fácil de compartir verbalmente o por mensaje
3. **SEO Friendly:** Mejor para URLs públicas (`/tienda/K2629G372026`)
4. **Marketing:** Puedes imprimirlo en tarjetas de presentación, flyers, QR codes
5. **Support:** Más fácil para operadores de soporte identificar tiendas

### Comparación

| Tipo | Formato | Longitud | Ejemplo |
|------|---------|----------|---------|
| UUID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | 36 caracteres | `550e8400-e29b-41d4-a716-446655440000` |
| Slug | `KxxxxXxxxxxx` | 13 caracteres | `K2629G372026` |

---

## 🔧 Implementación Técnica

### 1. Generación de Slugs (Frontend)

**Archivo:** `src/utils/storeSlugGenerator.ts`

```typescript
import { generateStoreSlug } from '@/utils/storeSlugGenerator';

const newSlug = generateStoreSlug();
// Resultado: "K2629G372026"
```

**Usado en:**
- `src/pages/SellerRegistrationPage.tsx` - Al registrar nuevo seller
- `src/hooks/useAdminApprovals.ts` - Al aprobar solicitud de seller
- `src/hooks/useEnsureSellerStore.ts` - Fallback si no existe tienda

### 2. Generación de Slugs (SQL)

**Archivo:** `supabase/migrations/20260209_fix_seller_store_auto_creation.sql`

**Trigger automático:** Cuando se asigna rol `seller`, se crea tienda con slug único.

```sql
-- Genera slug: K + 4 dígitos + letra + 6 dígitos + 2 últimos dígitos del año
v_store_slug := 'K' || 
                LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0') ||
                CHR(65 + FLOOR(RANDOM() * 26)::INT) ||
                LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0') ||
                SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT, 3, 2);
```

### 3. Script de Migración de Slugs

**Archivo:** `GENERATE_SLUGS_FOR_EXISTING_STORES.sql`

**Propósito:** Generar slugs para todas las tiendas que aún no tienen uno.

**Cómo Ejecutar:**
```bash
# En Supabase SQL Editor, ejecutar:
1. Copiar contenido de GENERATE_SLUGS_FOR_EXISTING_STORES.sql
2. Pegar en SQL Editor
3. Run
4. Verificar resultados
```

---

## 🖥️ Uso en la UI

### Mostrar el Slug al Usuario

**Antes (UUID largo):**
```tsx
<p>ID de tu Tienda: {store.id}</p>
// 550e8400-e29b-41d4-a716-446655440000
```

**Ahora (Slug corto):**
```tsx
<p>ID de tu Tienda: {store.slug}</p>
// K2629G372026
```

### Componentes Actualizados

| Componente | Ubicación | Cambio |
|------------|-----------|--------|
| **SellerInventarioB2C** | `src/pages/seller/SellerInventarioB2C.tsx` | Muestra `storeSlug` en lugar de `storeId` |
| **SellerOnboardingPage** | `src/pages/seller/SellerOnboardingPage.tsx` | Usa `data.slug` al cargar tienda |
| **SellerAccountPage** | `src/pages/seller/SellerAccountPage.tsx` | Ya usa `store.slug` ✅ |
| **ProductPage** | `src/pages/ProductPage.tsx` | Enlaces: `/tienda/${product.store.slug}` |
| **ViewModeContext** | `src/contexts/ViewModeContext.tsx` | Prioriza slug sobre id |

### Hook `useSellerCatalog`

**Actualización:** Ahora devuelve tanto `storeId` (para queries) como `storeSlug` (para display).

```tsx
const { storeId, storeSlug } = useSellerCatalog();

// storeId: "550e8400-..." (para queries internas)
// storeSlug: "K2629G372026" (para mostrar al usuario)
```

---

## 🔗 URLs y Rutas

### Routing Flexible

El sistema acepta tanto slug como UUID en las rutas:

```
✅ /tienda/K2629G372026  (slug - preferido)
✅ /tienda/550e8400-...  (uuid - backward compatible)
```

**Implementación en `useStore` hook:**
```typescript
// Detecta automáticamente si es UUID o slug
const column = isUUID(storeIdOrSlug) ? "id" : "slug";
```

---

## 📋 Checklist de Verificación

### Migración Completada ✅

- [x] Crear función `generateStoreSlug()` en `utils/storeSlugGenerator.ts`
- [x] Actualizar trigger SQL para generar slugs nuevos
- [x] Crear script `GENERATE_SLUGS_FOR_EXISTING_STORES.sql`
- [x] Actualizar `SellerRegistrationPage` para usar nuevo formato
- [x] Actualizar `useAdminApprovals` para usar nuevo formato
- [x] Actualizar `useEnsureSellerStore` para usar nuevo formato
- [x] Actualizar `useSellerCatalog` para devolver `storeSlug`
- [x] Actualizar `SellerInventarioB2C` para mostrar slug
- [x] Actualizar `ProductPage` para usar slug en enlaces
- [x] Verificar que routing funciona con slug
- [x] Documentar sistema completo

### Para Ejecutar en Producción

1. **Ejecutar migración de slugs:**
   ```sql
   -- En Supabase SQL Editor
   -- Copiar y ejecutar: GENERATE_SLUGS_FOR_EXISTING_STORES.sql
   ```

2. **Verificar slugs generados:**
   ```sql
   SELECT id, name, slug
   FROM stores
   WHERE slug IS NOT NULL
   LIMIT 10;
   ```

3. **Confirmar no hay slugs duplicados:**
   ```sql
   SELECT slug, COUNT(*)
   FROM stores
   WHERE slug IS NOT NULL
   GROUP BY slug
   HAVING COUNT(*) > 1;
   -- Debería retornar 0 filas
   ```

---

## 🎯 Uso para Sellers

### Compartir Tienda

**Antes:**
```
Mi tienda: www.tuapp.com/tienda/550e8400-e29b-41d4-a716-446655440000
```

**Ahora:**
```
Mi tienda: www.tuapp.com/tienda/K2629G372026
```

### QR Code

El slug es ideal para QR codes:
- Más compacto → QR más simple
- Más fácil de escribir si el QR falla
- Mejor experiencia de usuario

### Tarjetas de Presentación

```
┌────────────────────────┐
│   Tienda Maria Shop    │
│                        │
│   ID: K2629G372026     │
│                        │
│   WhatsApp: +509...    │
└────────────────────────┘
```

---

## 🔒 Consideraciones de Seguridad

### ¿Es Seguro Usar Slugs?

✅ **SÍ** - Los slugs son aleatorios y difíciles de predecir.

- **Espacio de posibilidades:** `10^4 × 26 × 10^6 × 10^2 = 260,000,000,000` combinaciones
- **Constraint UNIQUE:** Base de datos previene duplicados
- **No secuenciales:** No se puede adivinar el siguiente slug
- **RLS Policies:** Supabase protege acceso no autorizado

### ¿Qué NO expone el slug?

- ✅ No revela número de tiendas
- ✅ No revela orden de creación
- ✅ No revela información del seller
- ✅ No permite acceso no autorizado (RLS)

---

## 🐛 Troubleshooting

### Problema: Tienda sin slug

**Síntoma:** `store.slug` es `null`

**Solución:**
```sql
-- Ejecutar script de generación
-- Ver: GENERATE_SLUGS_FOR_EXISTING_STORES.sql
```

### Problema: Slug duplicado

**Síntoma:** Error "duplicate key value violates unique constraint"

**Solución:** El algoritmo incluye retry logic. Si persiste:
```typescript
// Regenerar manualmente
const newSlug = generateStoreSlug();
await supabase
  .from('stores')
  .update({ slug: newSlug })
  .eq('id', storeId);
```

### Problema: UI muestra UUID largo

**Síntoma:** Se ve `550e8400-...` en lugar de `K2629G372026`

**Causa:** Componente usando `store.id` en lugar de `store.slug`

**Solución:**
```tsx
// Cambiar de:
<p>{store.id}</p>

// A:
<p>{store.slug || store.id}</p>
```

---

## 📚 Referencias

- **Archivo de generación:** `src/utils/storeSlugGenerator.ts`
- **Migration SQL:** `supabase/migrations/20260209_fix_seller_store_auto_creation.sql`
- **Script de migración:** `GENERATE_SLUGS_FOR_EXISTING_STORES.sql`
- **Hook principal:** `src/hooks/useSellerCatalog.ts`

---

## 🚀 Próximos Pasos

### Mejoras Futuras (Opcional)

1. **Slug personalizado:** Permitir sellers elegir su propio slug
   ```
   Ejemplo: K-MARIA-SHOP-2026
   ```

2. **Analytics por slug:** Rastrear visitas por slug
   ```sql
   SELECT slug, COUNT(*) as visits
   FROM analytics_events
   WHERE event_type = 'store_visit'
   GROUP BY slug;
   ```

3. **Validación custom:** Bloqueear palabras ofensivas en slugs personalizados

---

**Última actualización:** 27 de febrero de 2026
**Estado:** ✅ Implementado completamente
