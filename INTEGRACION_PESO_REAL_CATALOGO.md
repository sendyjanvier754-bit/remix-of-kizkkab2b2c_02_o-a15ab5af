# 📱 INTEGRACIÓN: Mostrar Peso Real en Mi Catálogo del Seller

## 📋 RESUMEN

Hemos creado 3 funciones SQL que calculan el peso REAL (sin redondear) de los productos en el carrito del seller:

```
FUNCIÓN 1: calculate_real_weight_by_product()
 ├─ Input: product_id
 ├─ Output: peso_kg total, cantidad total, items en carrito
 └─ Uso: Ver peso de un producto completo

FUNCIÓN 2: calculate_real_weight_by_variant()
 ├─ Input: product_id + variant_id
 ├─ Output: peso_kg total de esa variante, cantidad, items
 └─ Uso: Ver peso de una variante específica

FUNCIÓN 3: get_catalog_product_weight_details()
 ├─ Input: product_id (+ variant_id opcional)
 ├─ Output: detalles completos (peso, precio, cantidad, costo total)
 └─ Uso: Para mostrar en tabla de catálogo
```

---

## 🚀 PASO 1: EJECUTAR LA FUNCIÓN SQL

```bash
# En tu terminal (psql)
psql -U postgres -d tu_base_de_datos -f FUNCION_CALCULAR_PESO_REAL_CATALOGO.sql
```

O copiar y pegar el contenido en tu editor SQL (Supabase).

---

## ✅ VERIFICAR INSTALACIÓN

```sql
-- Consultar que las funciones existen
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE 'calculate_real_weight%' 
   OR routine_name LIKE 'get_catalog_product_weight%'
ORDER BY routine_name;

-- Debe mostrarte:
-- calculate_real_weight_by_product
-- calculate_real_weight_by_variant
-- get_catalog_product_weight_details
```

---

## 🔧 PASO 2: CREAR HOOK EN FRONTEND

**Archivo: `src/hooks/useCatalogProductWeights.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para obtener peso real de un producto en el carrito (sin redondear)
 * @param productId - ID del producto
 * @returns {total_weight_kg, weight_rounded_kg, total_quantity, items_count}
 */
export function useCatalogProductWeight(productId: string | undefined) {
  return useQuery({
    queryKey: ['catalogProductWeight', productId],
    queryFn: async () => {
      if (!productId) return null;

      const { data, error } = await supabase
        .rpc('calculate_real_weight_by_product', {
          p_product_id: productId
        })
        .single();

      if (error) {
        console.error('Error fetching product weight:', error);
        throw error;
      }

      return data;
    },
    enabled: !!productId,
    staleTime: 10000, // 10 segundos
    refetchInterval: 30000, // Refetch cada 30s
  });
}

/**
 * Hook para obtener peso real de una variante específica
 * @param productId - ID del producto
 * @param variantId - ID de la variante
 * @returns {total_weight_kg, weight_rounded_kg, total_quantity, items_count}
 */
export function useCatalogVariantWeight(
  productId: string | undefined,
  variantId: string | undefined
) {
  return useQuery({
    queryKey: ['catalogVariantWeight', productId, variantId],
    queryFn: async () => {
      if (!productId || !variantId) return null;

      const { data, error } = await supabase
        .rpc('calculate_real_weight_by_variant', {
          p_product_id: productId,
          p_variant_id: variantId
        })
        .single();

      if (error) {
        console.error('Error fetching variant weight:', error);
        throw error;
      }

      return data;
    },
    enabled: !!productId && !!variantId,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para obtener detalles completos (peso + precio + cantidad)
 * @param productId - ID del producto
 * @param variantId - ID de la variante (opcional)
 * @returns {product_name, variant_name, total_weight_kg, cost_per_unit, total_cost, ...}
 */
export function useCatalogProductWeightDetails(
  productId: string | undefined,
  variantId: string | undefined = undefined
) {
  return useQuery({
    queryKey: ['catalogProductWeightDetails', productId, variantId],
    queryFn: async () => {
      if (!productId) return null;

      const { data, error } = await supabase
        .rpc('get_catalog_product_weight_details', {
          p_product_id: productId,
          p_variant_id: variantId || null
        });

      if (error) {
        console.error('Error fetching product details:', error);
        throw error;
      }

      // La función puede retornar múltiples filas (una por variante)
      // si no especificas variant_id
      return data;
    },
    enabled: !!productId,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para obtener todos los productos con sus pesos (vista)
 * @returns Array de productos con sus pesos
 */
export function useCatalogAllProductWeights() {
  return useQuery({
    queryKey: ['catalogAllProductWeights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_catalog_product_weights')
        .select('*')
        .order('total_quantity', { ascending: false });

      if (error) {
        console.error('Error fetching catalog weights:', error);
        throw error;
      }

      return data;
    },
    staleTime: 15000,
    refetchInterval: 60000, // Refetch cada minuto
  });
}

/**
 * Hook para obtener pesos por variante
 * @param productId - ID del producto (opcional para filtrar)
 * @returns Array de variantes con sus pesos
 */
export function useCatalogVariantWeights(productId?: string) {
  return useQuery({
    queryKey: ['catalogVariantWeights', productId],
    queryFn: async () => {
      let query = supabase
        .from('v_catalog_variant_weights')
        .select('*');

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query.order('product_name').order('variant_name');

      if (error) {
        console.error('Error fetching variant weights:', error);
        throw error;
      }

      return data;
    },
    enabled: true,
    staleTime: 15000,
    refetchInterval: 60000,
  });
}
```

---

## 🎨 PASO 3: USAR EN COMPONENTE (EJEMPLO)

**Ejemplo en Mi Catálogo del Seller:**

```tsx
import { useCatalogProductWeight, useCatalogProductWeightDetails } from '@/hooks/useCatalogProductWeights';
import { Loader2 } from 'lucide-react';

export function SellerCatalogItemCard({ productId, productName, variantId }: Props) {
  // Obtener peso real del producto
  const { data: productWeight, isLoading: isLoadingWeight } = useCatalogProductWeight(productId);

  // Obtener detalles completos (opcional)
  const { data: productDetails } = useCatalogProductWeightDetails(productId, variantId);

  return (
    <div className="product-card border rounded-lg p-4">
      {/* Nombre del producto */}
      <h3 className="text-lg font-bold">{productName}</h3>

      {/* Datos Originales */}
      <div className="mt-3 space-y-2 bg-gray-50 p-2 rounded text-xs">
        <p><strong>Stock:</strong> {productWeight?.total_quantity || 0} unidades</p>
        <p><strong>Items en carrito:</strong> {productWeight?.items_count || 0}</p>
      </div>

      {/* Peso Real - SIN REDONDEAR */}
      <div className="mt-3 bg-blue-50 border border-blue-200 p-3 rounded">
        {isLoadingWeight ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Calculando peso...</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-blue-900">
              <strong>Peso Real (exacto):</strong> {productWeight?.total_weight_kg?.toFixed(3) || 0} kg
            </p>
            <p className="text-xs text-blue-700 mt-1">
              ℹ️ Este es el peso real de los artículos en el carrito, SIN redondear
            </p>
          </>
        )}
      </div>

      {/* Peso para Envío - REDONDEADO (solo referencia) */}
      <div className="mt-2 bg-orange-50 border border-orange-200 p-3 rounded">
        <p className="text-sm text-orange-900">
          <strong>Peso para Cálculo de Envío:</strong> {productWeight?.weight_rounded_kg || 0} kg
        </p>
        <p className="text-xs text-orange-700 mt-1">
          ℹ️ Este es el peso redondeado hacia arriba (CEIL), usado para calcular costo de envío
        </p>
      </div>

      {/* Detalles adicionales si existen */}
      {productDetails && productDetails.length > 0 && (
        <div className="mt-3 bg-green-50 border border-green-200 p-3 rounded">
          <p className="text-xs font-semibold text-green-900">Detalles:</p>
          {productDetails.map((detail: any, idx: number) => (
            <div key={idx} className="text-xs text-green-800 mt-1">
              <p>Variante: {detail.variant_name}</p>
              <p>Precio unitario: ${detail.cost_per_unit?.toFixed(2)}</p>
              <p>Costo total: ${detail.total_cost?.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 📊 EJEMPLO EN TABLA

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCatalogAllProductWeights } from '@/hooks/useCatalogProductWeights';

export function SellerCatalogTable() {
  const { data: products, isLoading } = useCatalogAllProductWeights();

  if (isLoading) return <div>Cargando...</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead>Items en Carrito</TableHead>
          <TableHead>Cantidad Total</TableHead>
          <TableHead>Peso Real (kg)</TableHead>
          <TableHead>Peso para Envío (kg)</TableHead>
          <TableHead>Carritos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products?.map((product: any) => (
          <TableRow key={product.product_id}>
            <TableCell className="font-medium">{product.product_name}</TableCell>
            <TableCell>{product.items_in_carts}</TableCell>
            <TableCell>{product.total_quantity}</TableCell>
            <TableCell className="text-blue-600 font-bold">
              {product.total_weight_real_kg?.toFixed(3)} kg
            </TableCell>
            <TableCell className="text-orange-600 font-bold">
              {product.total_weight_rounded_kg} kg
            </TableCell>
            <TableCell>{product.carts_with_product}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## 🔄 SUSCRIPCIÓN EN REALTIME (OPCIONAL)

Si quieres actualizaciones en tiempo real cuando cambien los pesos:

```typescript
useEffect(() => {
  if (!productId) return;

  // Suscribirse a cambios en b2b_cart_items
  const subscription = supabase
    .channel(`product_weight_${productId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'b2b_cart_items',
        filter: `product_id=eq.${productId}`
      },
      () => {
        // Refetch del hook
        refetch();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}, [productId, refetch]);
```

---

## 📝 RESUMEN: DIFERENCIA ENTRE PESOS

| Concepto | Cálculo | Ejemplo | Uso |
|----------|---------|---------|-----|
| **Peso Real** | SUM(peso_kg × cantidad) | 1.5 kg | Mostrar en catálogo, info al usuario |
| **Peso Redondeado** | CEIL(peso real) | 2 kg | Calcular costo de envío |
| **Costo Envío** | (peso_redondeado × tramo_a) + (peso_redondeado × tramo_b) | $12.50 | Factura final |

---

## 🛠️ QUERIES SQL ÚTILES

```sql
-- Ver todos los productos con sus pesos reales
SELECT * FROM v_catalog_product_weights;

-- Ver todas las variantes con sus pesos reales
SELECT * FROM v_catalog_variant_weights;

-- Obtener peso real de un producto específico
SELECT * FROM calculate_real_weight_by_product('product-uuid');

-- Obtener peso real de una variante específica
SELECT * FROM calculate_real_weight_by_variant('product-uuid', 'variant-uuid');

-- Obtener detalles completos
SELECT * FROM get_catalog_product_weight_details('product-uuid');
```

---

## ✨ VENTAJAS

✅ **Peso Real**: Muestra exactitud sin redondear
✅ **Fácil de Usar**: Solo 3 funciones SQL
✅ **Performance**: Usando STABLE y READONLY
✅ **Flexible**: Funciona con productos y variantes
✅ **Reactivo**: Puedes usar con Realtime
✅ **Separación Clara**: Peso para mostrar ≠ Peso para envío

