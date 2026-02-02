# Guía del Sistema de Eliminación Segura de Productos

## 📋 Resumen Ejecutivo

Sistema completo de eliminación de productos que maneja automáticamente:
- ✅ Eliminación en cascada de variantes, atributos e imágenes
- ✅ Cancelación automática de órdenes pendientes/confirmadas/en_po/processing
- ✅ Generación automática de solicitudes de reembolso
- ✅ Marcado de imágenes para limpieza posterior
- ✅ Registro detallado de acciones realizadas

---

## 🏗️ Arquitectura

### 1. Función SQL: `delete_product_cascade()`

**Ubicación:** `20260202_delete_product_cascade.sql`

**Firma:**
```sql
delete_product_cascade(
  p_product_id UUID,
  p_delete_reason TEXT DEFAULT 'Producto discontinuado'
) RETURNS JSONB
```

**Flujo de Ejecución:**

```
1. VALIDACIÓN
   └─ Verificar que el producto existe
   └─ Si no existe → ERROR 'PRODUCT_NOT_FOUND'

2. RECOLECCIÓN DE IMÁGENES
   └─ imagen_principal del producto
   └─ imagen_url de todas las variantes
   └─ Almacenar en array images_to_cleanup[]

3. CANCELACIÓN DE ÓRDENES
   └─ Buscar órdenes con status IN ('pending', 'confirmed', 'in_po', 'processing')
   └─ Para cada orden encontrada:
       ├─ UPDATE orders_b2b SET:
       │   ├─ status = 'cancelled'
       │   ├─ cancellation_reason = 'Producto eliminado: [razón]'
       │   └─ cancelled_at = NOW()
       └─ INSERT INTO refund_requests:
           ├─ order_id = order.id
           ├─ buyer_id = order.buyer_id
           ├─ status = 'pending'
           ├─ request_type = 'automatic'
           └─ reason = 'Producto eliminado del catálogo'

4. ELIMINACIÓN EN CASCADA
   └─ DELETE variant_attribute_values (atributos de variantes)
   └─ DELETE product_variants (SKUs/variantes)
   └─ DELETE product_markets (asignaciones a mercados)
   └─ DELETE wishlist (favoritos de clientes)
   └─ DELETE product_reviews (reseñas)
   └─ DELETE cart_items (carritos activos)
   └─ DELETE product_shipping_classes (clases de envío)

5. REGISTRO DE IMÁGENES
   └─ INSERT INTO deleted_product_images:
       ├─ product_id
       ├─ image_urls (JSONB array)
       ├─ deleted_at = NOW()
       └─ cleaned_up = FALSE

6. ELIMINACIÓN DEL PRODUCTO
   └─ DELETE FROM products WHERE id = p_product_id

7. RETORNO DE RESULTADOS
   └─ RETURN JSONB {
       "success": true,
       "product_id": "...",
       "variants_deleted": 5,
       "orders_cancelled": 3,
       "refunds_created": 3,
       "images_marked_for_cleanup": 8,
       "deleted_at": "2026-02-02T..."
     }
```

**Manejo de Errores:**
```sql
-- Producto no existe
RAISE EXCEPTION 'Product % not found' USING ERRCODE = 'PRODUCT_NOT_FOUND';

-- Error durante eliminación
RETURN jsonb_build_object(
  'success', false,
  'error', SQLERRM
);
```

---

### 2. React Hook: `useProductDeletion`

**Ubicación:** `src/hooks/useProductDeletion.ts`

**Exports:**

```typescript
// 1. Función principal de eliminación
deleteProduct({
  productId: string,
  productName: string,
  deleteReason?: string,
  onSuccess?: () => void,
  onError?: (error: Error) => void
}): Promise<void>

// 2. React Query Mutation
deleteProductMutation: UseMutationResult<DeletionResult, Error, DeleteProductParams>

// 3. Confirmación con diálogo
confirmDelete(
  productName: string,
  onSuccess?: () => void,
  productId?: string,
  deleteReason?: string
): Promise<void>

// 4. Limpieza de imágenes
cleanupDeletedImages(productId: string): Promise<void>

// 5. Estados
isDeleting: boolean
deleteResult: DeletionResult | null
```

**Características:**

✅ **Invalidación Automática de Queries:**
```typescript
queryClient.invalidateQueries({ queryKey: ['products'] });
queryClient.invalidateQueries({ queryKey: ['catalog'] });
queryClient.invalidateQueries({ queryKey: ['orders'] });
queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
```

✅ **Toast Notifications:**
```typescript
// Toast de éxito con resumen detallado
toast({
  title: "Producto Eliminado",
  description: `
    - ${result.variants_deleted} variantes eliminadas
    - ${result.orders_cancelled} órdenes canceladas
    - ${result.refunds_created} reembolsos generados
    - ${result.images_marked_for_cleanup} imágenes marcadas
  `
});

// Toast de error
toast({
  title: "Error al Eliminar",
  description: error.message,
  variant: "destructive"
});
```

✅ **Diálogo de Confirmación:**
```typescript
if (confirm(`¿Eliminar "${productName}"? Esta acción:
- Borrará todas las variantes y SKUs
- Cancelará órdenes pendientes/confirmadas
- Generará solicitudes de reembolso automáticas
- Marcará imágenes para limpieza

¿Continuar?`))
```

---

## 🔧 Uso e Implementación

### Paso 1: Ejecutar la Migración SQL

```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: 20260202_delete_product_cascade.sql

-- Verificar creación exitosa
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'delete_product_cascade';

-- Salida esperada:
-- routine_name: delete_product_cascade
```

### Paso 2: Importar el Hook en un Componente

**Ejemplo: ProductEditDialog.tsx** (Ya implementado ✅)

```typescript
import { useProductDeletion } from '@/hooks/useProductDeletion';

const ProductEditDialog = ({ productId, open, onOpenChange }) => {
  const { confirmDelete, isDeleting } = useProductDeletion();

  const handleDelete = async () => {
    await confirmDelete(
      product?.nombre || 'este producto',
      () => {
        onOpenChange(false); // Cerrar diálogo después de eliminar
      },
      productId
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ... */}
      <Button 
        variant="destructive" 
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Eliminando...
          </>
        ) : (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar Producto
          </>
        )}
      </Button>
    </Dialog>
  );
};
```

### Paso 3: Uso Alternativo (Sin Confirmación)

```typescript
import { useProductDeletion } from '@/hooks/useProductDeletion';

const ProductCard = ({ product }) => {
  const { deleteProduct, isDeleting } = useProductDeletion();

  const handleQuickDelete = async () => {
    // Confirmación manual
    const confirmed = window.confirm(
      `¿Eliminar "${product.nombre}"?`
    );

    if (confirmed) {
      await deleteProduct({
        productId: product.id,
        productName: product.nombre,
        deleteReason: 'Eliminación rápida desde catálogo',
        onSuccess: () => {
          console.log('Producto eliminado exitosamente');
        },
        onError: (error) => {
          console.error('Error:', error);
        }
      });
    }
  };

  return (
    <Card>
      <Button onClick={handleQuickDelete} disabled={isDeleting}>
        Eliminar
      </Button>
    </Card>
  );
};
```

---

## 📊 Respuestas y Datos Retornados

### Respuesta Exitosa de `delete_product_cascade()`

```json
{
  "success": true,
  "product_id": "123e4567-e89b-12d3-a456-426614174000",
  "variants_deleted": 8,
  "orders_cancelled": 3,
  "refunds_created": 3,
  "images_marked_for_cleanup": 12,
  "deleted_at": "2026-02-02T14:30:00.000Z"
}
```

### Respuesta de Error

```json
{
  "success": false,
  "error": "Product not found",
  "product_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Tipo TypeScript

```typescript
interface DeletionResult {
  success: boolean;
  product_id: string;
  variants_deleted: number;
  orders_cancelled: number;
  refunds_created: number;
  images_marked_for_cleanup: number;
  deleted_at: string;
  error?: string;
}
```

---

## 🔍 Verificación Post-Eliminación

### Query 1: Verificar Órdenes Canceladas

```sql
SELECT 
  id,
  order_number,
  status,
  cancellation_reason,
  cancelled_at
FROM orders_b2b
WHERE cancellation_reason LIKE '%Producto eliminado%'
ORDER BY cancelled_at DESC
LIMIT 10;
```

### Query 2: Verificar Reembolsos Generados

```sql
SELECT 
  r.id,
  r.order_id,
  o.order_number,
  r.status,
  r.request_type,
  r.reason,
  r.created_at
FROM refund_requests r
JOIN orders_b2b o ON r.order_id = o.id
WHERE r.request_type = 'automatic'
  AND r.reason LIKE '%Producto eliminado%'
ORDER BY r.created_at DESC;
```

### Query 3: Verificar Imágenes Pendientes de Limpieza

```sql
SELECT 
  product_id,
  image_urls,
  deleted_at,
  cleaned_up
FROM deleted_product_images
WHERE cleaned_up = FALSE
ORDER BY deleted_at DESC;
```

### Query 4: Verificar Producto Eliminado

```sql
-- Debe retornar 0 filas
SELECT * FROM products WHERE id = '<product_id>';

-- Debe retornar 0 filas
SELECT * FROM product_variants WHERE product_id = '<product_id>';
```

---

## 🧹 Limpieza de Imágenes (Opcional)

### Función SQL: `cleanup_deleted_product_images()`

```sql
-- Marcar imágenes como limpiadas después de borrarlas manualmente
SELECT cleanup_deleted_product_images('<product_id>');
```

### Uso en React Hook

```typescript
const { cleanupDeletedImages } = useProductDeletion();

// Después de borrar manualmente las imágenes de Supabase Storage
await cleanupDeletedImages(productId);

// Toast notification:
// "Registros de limpieza actualizados para el producto"
```

### Job Programado (Sugerencia)

```typescript
// Ejemplo de cron job para limpiar imágenes semanalmente
// packages/functions/cleanup-deleted-images.ts

import { supabase } from './supabase';
import { storage } from './storage';

export async function cleanupImages() {
  // 1. Obtener imágenes pendientes
  const { data: records } = await supabase
    .from('deleted_product_images')
    .select('*')
    .eq('cleaned_up', false);

  for (const record of records || []) {
    const imageUrls = record.image_urls as string[];

    // 2. Borrar de Supabase Storage
    for (const url of imageUrls) {
      const path = extractPathFromUrl(url);
      await storage.from('products').remove([path]);
    }

    // 3. Marcar como limpiado
    await supabase.rpc('cleanup_deleted_product_images', {
      p_product_id: record.product_id
    });
  }
}
```

---

## ⚠️ Advertencias y Limitaciones

### 🔴 CRÍTICO

1. **No hay deshacer:** Una vez ejecutada, la eliminación es permanente
2. **Reembolsos automáticos:** Los reembolsos se crean con status='pending', requieren aprobación manual
3. **Imágenes no se borran:** Solo se marcan para limpieza, requiere proceso separado

### 🟡 IMPORTANTE

1. **Órdenes en estados avanzados:**
   - `shipped`: No se cancelan (ya enviadas)
   - `delivered`: No se cancelan (ya entregadas)
   - `cancelled`: No se procesan (ya canceladas)

2. **Productos en múltiples órdenes:**
   - Si una orden tiene múltiples productos, solo se cancela si uno de ellos es eliminado
   - Considerar verificar manualmente órdenes complejas

3. **Performance:**
   - Con muchas órdenes relacionadas (>100), la función puede tardar
   - Considerar agregar índices en `order_items.product_id`

### 🟢 RECOMENDACIONES

1. **Backup antes de eliminar productos críticos:**
```sql
-- Exportar producto antes de eliminar
COPY (
  SELECT * FROM products WHERE id = '<product_id>'
) TO '/tmp/product_backup.csv' WITH CSV HEADER;
```

2. **Verificar dependencias primero:**
```sql
-- Ver cuántas órdenes se afectarán
SELECT COUNT(DISTINCT oi.order_id)
FROM order_items oi
JOIN orders_b2b o ON oi.order_id = o.id
WHERE oi.product_id = '<product_id>'
  AND o.status IN ('pending', 'confirmed', 'in_po', 'processing');
```

3. **Desactivar en lugar de eliminar (alternativa):**
```sql
-- Simplemente marcar como inactivo
UPDATE products SET is_active = FALSE WHERE id = '<product_id>';
```

---

## 📝 Checklist de Implementación

- [x] Crear migración SQL `20260202_delete_product_cascade.sql`
- [x] Crear React hook `useProductDeletion.ts`
- [x] Integrar en `ProductEditDialog.tsx`
- [ ] Ejecutar migración en Supabase Production
- [ ] Probar eliminación en producto de prueba
- [ ] Verificar órdenes canceladas
- [ ] Verificar reembolsos generados
- [ ] Documentar proceso de limpieza de imágenes
- [ ] Crear dashboard de reembolsos pendientes
- [ ] Agregar logs/auditoría de eliminaciones

---

## 🆘 Troubleshooting

### Error: "Product not found"
**Causa:** El producto ya fue eliminado o el ID es incorrecto  
**Solución:** Verificar que el producto existe:
```sql
SELECT id, nombre FROM products WHERE id = '<product_id>';
```

### Error: "Foreign key violation"
**Causa:** Existen relaciones que no se están eliminando  
**Solución:** Verificar constraints:
```sql
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
  AND constraint_schema = 'public';
```

### Error: "Permission denied"
**Causa:** Usuario no tiene permisos para ejecutar la función  
**Solución:** La función tiene `SECURITY DEFINER`, debe ejecutarse como admin:
```sql
-- Verificar permisos
SELECT routine_name, security_type 
FROM information_schema.routines 
WHERE routine_name = 'delete_product_cascade';
```

### Toast no aparece después de eliminar
**Causa:** React Query no está invalidando correctamente  
**Solución:** Verificar que `QueryClientProvider` envuelve el componente:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

---

## 📚 Referencias

- **Archivo SQL:** `20260202_delete_product_cascade.sql`
- **Hook React:** `src/hooks/useProductDeletion.ts`
- **Implementación:** `src/components/catalog/ProductEditDialog.tsx`
- **Documentación:** Este archivo (`PRODUCT_DELETION_GUIDE.md`)

---

## 📞 Soporte

Para problemas o preguntas:
1. Revisar este documento completo
2. Verificar logs de Supabase en el Dashboard
3. Revisar toast notifications en la UI
4. Ejecutar queries de verificación incluidas aquí

---

**Última Actualización:** 2 de febrero de 2026  
**Versión:** 1.0.0  
**Estado:** ✅ Implementado y documentado
