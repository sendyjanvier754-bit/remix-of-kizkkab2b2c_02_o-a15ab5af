# 🚚 INTEGRACIÓN: Mostrar Envío Más Rápido en Mi Catálogo

## 📋 RESUMEN

Hemos creado una función SQL que **calcula el costo del ENVÍO MÁS RÁPIDO** para cada producto en el catálogo:

```
INPUT:  product_id
OUTPUT: 
  - product_name
  - total_weight_kg (peso real, sin redondear)
  - weight_rounded_kg (para referencia, CEIL)
  - fastest_shipping_tier (nombre: EXPRESS, FAST, etc)
  - fastest_shipping_cost_usd (costo del envío más rápido)
  - formula_description (explicación del cálculo)
```

---

## ⚡ ¿QUÉ HACE?

La función busca el **ENVÍO MÁS RÁPIDO** disponible (EXPRESS > FAST > Primero) y calcula:

```
PESO REAL = SUM(peso_kg × cantidad) en cartuchos abiertos
           ↓
PESO REDONDEADO = CEIL(peso real)
           ↓
COSTO = (peso_kg × tramo_a_cost_per_kg) + (peso_lb × tramo_b_cost_per_lb)

Ejemplo:
1.5 kg de producto
  → tier EXPRESS (tramo_a: $7.50/kg, tramo_b: $2.50/lb)
  → peso redondeado: 2 kg
  → costo: (2 × $7.50) + (4.41 × $2.50) = $15.00 + $11.03 = $26.03
```

---

## 🚀 PASO 1: EJECUTAR LA FUNCIÓN SQL

```bash
# En tu terminal
psql -U postgres -d tu_base_de_datos -f FUNCION_FASTEST_SHIPPING_COST_CATALOGO.sql
```

---

## ✅ VERIFICAR INSTALACIÓN

```sql
-- Verificar que la función existe
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'get_catalog_fastest_shipping_cost_by_product';

-- Verificar que las vistas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'v_catalog_product%'
ORDER BY table_name;

-- Debe mostrar:
-- v_catalog_products_with_fastest_shipping
-- v_catalog_product_weight_and_shipping
```

---

## 🔧 PASO 2: CREAR HOOK EN FRONTEND

**Archivo: `src/hooks/useCatalogFastestShipping.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para obtener el costo del ENVÍO MÁS RÁPIDO para un producto
 * @param productId - UUID del producto
 * @returns {fastest_shipping_tier, fastest_shipping_cost_usd, total_weight_kg, ...}
 */
export function useCatalogFastestShippingCost(productId: string | undefined) {
  return useQuery({
    queryKey: ['catalogFastestShipping', productId],
    queryFn: async () => {
      if (!productId) return null;

      const { data, error } = await supabase
        .rpc('get_catalog_fastest_shipping_cost_by_product', {
          p_product_id: productId
        })
        .single();

      if (error) {
        console.error('Error fetching fastest shipping cost:', error);
        throw error;
      }

      return data;
    },
    enabled: !!productId,
    staleTime: 20000,    // 20 segundos
    refetchInterval: 60000, // Refetch cada minuto
  });
}

/**
 * Hook para obtener TODOS los productos con su envío más rápido (vista)
 * @returns Array de productos con shipping más rápido
 */
export function useCatalogAllProductsWithFastestShipping() {
  return useQuery({
    queryKey: ['catalogAllProductsFastestShipping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_catalog_products_with_fastest_shipping')
        .select('*')
        .order('fastest_shipping_cost_usd', { ascending: false });

      if (error) {
        console.error('Error fetching fastest shipping:', error);
        throw error;
      }

      return data;
    },
    staleTime: 30000,
    refetchInterval: 120000, // Refetch cada 2 minutos
  });
}

/**
 * Hook para obtener vista extendida con precios y totales
 * @returns Array de productos con detalles de precio y envío
 */
export function useCatalogProductWeightAndShipping() {
  return useQuery({
    queryKey: ['catalogProductWeightAndShipping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_catalog_product_weight_and_shipping')
        .select('*')
        .order('product_name', { ascending: true });

      if (error) {
        console.error('Error fetching product weight and shipping:', error);
        throw error;
      }

      return data;
    },
    staleTime: 30000,
    refetchInterval: 120000,
  });
}
```

---

## 🎨 PASO 3: USAR EN COMPONENTE

### Opción A: Tarjeta de Producto (Card)

```tsx
import { useCatalogFastestShippingCost } from '@/hooks/useCatalogFastestShipping';
import { Loader2, Truck } from 'lucide-react';

export function CatalogProductCard({ productId, productName, price }: Props) {
  const { data: shipping, isLoading } = useCatalogFastestShippingCost(productId);

  return (
    <div className="product-card border rounded-lg p-4 space-y-3">
      {/* Nombre y precio */}
      <div>
        <h3 className="text-lg font-bold">{productName}</h3>
        <p className="text-2xl font-bold text-green-600">${price}</p>
      </div>

      {/* Peso */}
      {shipping && (
        <div className="text-xs text-gray-600 space-y-1">
          <p>
            Peso: <strong>{shipping.total_weight_kg.toFixed(2)} kg</strong>
          </p>
          <p>
            En carrito: <strong>{shipping.items_in_carts} items</strong> (
            {shipping.carts_with_product} carritos)
          </p>
        </div>
      )}

      {/* Envío más rápido */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Calculando envío...</span>
          </div>
        ) : shipping?.fastest_shipping_cost_usd ? (
          <>
            <div className="flex items-center gap-2 text-xs text-blue-700 mb-1">
              <Truck className="w-4 h-4" />
              <span className="font-semibold">{shipping.fastest_shipping_tier}</span>
            </div>
            <p className="text-lg font-bold text-blue-900">
              $${shipping.fastest_shipping_cost_usd.toFixed(2)}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Costo del envío más rápido disponible
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-500">No hay envío disponible</p>
        )}
      </div>

      {/* Botón */}
      <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
        Ver Detalles
      </button>
    </div>
  );
}
```

---

### Opción B: Tabla de Catálogo Completa

```tsx
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useCatalogProductWeightAndShipping } from '@/hooks/useCatalogFastestShipping';
import { Loader2 } from 'lucide-react';

export function SellerCatalogTable() {
  const { data: products, isLoading } = useCatalogProductWeightAndShipping();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">SKU</TableHead>
            <TableHead className="text-center">Items</TableHead>
            <TableHead className="text-center">Carritos</TableHead>
            <TableHead className="text-right">Peso Real (kg)</TableHead>
            <TableHead className="text-right">Peso Envío (kg)</TableHead>
            <TableHead>Envío Rápido</TableHead>
            <TableHead className="text-right">Costo Envío</TableHead>
            <TableHead className="text-right">Precio Unit.</TableHead>
            <TableHead className="text-right">Total + Envío</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products?.map((product: any) => (
            <TableRow key={product.product_id} className="hover:bg-gray-50">
              {/* Nombre */}
              <TableCell className="font-medium">
                {product.product_name}
              </TableCell>

              {/* SKU */}
              <TableCell className="text-right text-xs text-gray-600">
                {product.product_sku}
              </TableCell>

              {/* Items en carritos */}
              <TableCell className="text-center">
                {product.items_in_carts}
              </TableCell>

              {/* Cantidad de carritos */}
              <TableCell className="text-center">
                {product.carts_with_product}
              </TableCell>

              {/* Peso Real (azul) */}
              <TableCell className="text-right">
                <span className="text-blue-600 font-bold">
                  {product.total_weight_kg?.toFixed(3)} kg
                </span>
              </TableCell>

              {/* Peso Redondeado (naranja) */}
              <TableCell className="text-right">
                <span className="text-orange-600 font-bold">
                  {product.weight_rounded_kg} kg
                </span>
              </TableCell>

              {/* Tipo de envío */}
              <TableCell>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                  {product.fastest_shipping_tier}
                </span>
              </TableCell>

              {/* Costo del envío */}
              <TableCell className="text-right font-bold text-green-600">
                ${product.fastest_shipping_cost_usd?.toFixed(2)}
              </TableCell>

              {/* Precio unitario */}
              <TableCell className="text-right">
                ${product.base_price_usd?.toFixed(2)}
              </TableCell>

              {/* Total con envío más rápido */}
              <TableCell className="text-right font-bold text-lg">
                ${product.total_with_fastest_shipping?.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

### Opción C: Widget Pequeño (inline)

```tsx
import { useCatalogFastestShippingCost } from '@/hooks/useCatalogFastestShipping';
import { Truck, AlertCircle } from 'lucide-react';

export function FastestShippingBadge({ productId }: { productId: string }) {
  const { data: shipping, isLoading } = useCatalogFastestShippingCost(productId);

  if (isLoading) return <span className="text-xs text-gray-400">Cargando...</span>;

  if (!shipping) {
    return (
      <div className="flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="w-3 h-3" />
        <span>No disponible</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200">
      <Truck className="w-4 h-4 text-blue-600" />
      <span className="text-xs text-blue-900 font-semibold">
        {shipping.fastest_shipping_tier}
      </span>
      <span className="text-xs text-blue-700 font-bold">
        ${shipping.fastest_shipping_cost_usd.toFixed(2)}
      </span>
    </div>
  );
}
```

---

## 📊 PREFERENCIA: ¿CUÁL OPCIÓN?

| Opción | Uso | Ventaja |
|--------|-----|---------|
| **Card** | Catálogo con vista de grid | Visual atractivo, fácil de ver |
| **Tabla** | Lista completa de productos | Información detallada, comparación fácil |
| **Badge** | Dentro de otra tabla/componente | Compacto, no toma mucho espacio |

---

## 📝 QUERIES SQL ÚTILES

```sql
-- VER todos los productos con envío más rápido
SELECT * FROM v_catalog_products_with_fastest_shipping;

-- VER con detalles de precio
SELECT * FROM v_catalog_product_weight_and_shipping 
ORDER BY fastest_shipping_cost_usd DESC
LIMIT 20;

-- VER solo productos con peso > 10kg
SELECT * FROM v_catalog_product_weight_and_shipping 
WHERE total_weight_kg > 10
ORDER BY fastest_shipping_cost_usd DESC;

-- VER costo específico de un producto
SELECT * FROM get_catalog_fastest_shipping_cost_by_product('product-uuid');
```

---

## 🔄 ACTUALIZACIÓN AUTOMÁTICA

Los datos se refetch cada **60-120 segundos**, pero para actualización manual:

```tsx
// En el componente que usa el hook:
const queryClient = useQueryClient();

// Cuando haya cambio en carrito:
const handleCartChange = async () => {
  await queryClient.invalidateQueries({ 
    queryKey: ['catalogFastestShipping'] 
  });
};
```

---

## 📚 DIFERENCIA CON FUNCIÓN ANTERIOR

| Función | Uso | Peso | Costo |
|---------|-----|------|-------|
| `calculate_real_weight_by_product()` | Peso exacto | Real (sin redondear) | ❌ No calcula |
| `get_catalog_fastest_shipping_cost_by_product()` | **Esto es nuevo** | Real → Redondeado | ✅ Envío más rápido |
| `get_catalog_product_weight_details()` | Detalles con precios | Real y redondeado | ❌ No calcula |

---

## 🎯 PRÓXIMO PASO

1. ✅ Ejecutar el SQL en Supabase
2. ✅ Crear los hooks
3. ✅ Usar en SellerMiCatalogoPage
4. ✅ Mostrar en tabla o tarjetas

¿Necesitas ayuda integrando en el componente `SellerMiCatalogoPage`?
