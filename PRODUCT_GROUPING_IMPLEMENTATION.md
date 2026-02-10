# Implementación de Agrupación de Productos y Variantes - Catálogo Seller

## Resumen

Se ha implementado una vista de catálogo mejorada que agrupa productos padre y muestra todas sus variantes de forma jerárquica, incluyendo:

1. **Productos padre** con información agregada
2. **Variantes compradas/importadas** por el vendedor (con costo de logística)
3. **Variantes disponibles** en el catálogo del admin (referencia para importación)

## Cambios Realizados

### 1. `src/hooks/useSellerCatalog.ts`

#### Interfaz Agregada: `ProductoConVariantes`
```typescript
interface ProductoConVariantes {
  productId: string;                           // ID del producto padre
  nombreProducto: string;                      // Nombre del producto
  imagenPrincipal: string | null;              // Imagen principal
  marcaProducto: string | null;                // Marca del producto
  variantes: SellerCatalogItem[];              // Variantes compradas/importadas
  variantes_disponibles: {                     // Variantes disponibles en admin catalog
    id: string;
    nombre: string;
    sku: string;
    weight_kg: number;
  }[];
  totalStock: number;                          // Stock total agregado
  precioMinimo: number;                        // Precio mínimo entre variantes
  precioMaximo: number;                        // Precio máximo entre variantes
  costoMinimo: number;                         // Costo mínimo entre variantes
  precioLogisticaMinimo: number;               // Costo logístico mínimo
}
```

#### Función Nueva: `groupByProduct()`
```typescript
const groupByProduct = useCallback(async (): Promise<ProductoConVariantes[]> => {
  // Agrupa items por sourceProductId
  // Para cada grupo:
  //   1. Obtiene datos del producto padre (nombre, imagen, marca)
  //   2. Obtiene variantes disponibles en product_variants
  //   3. Calcula agregaciones (stock total, precios min/max, costo logístico)
  // Retorna: ProductoConVariantes[]
}, [items]);
```

**Características:**
- Grouping por `sourceProductId` o `item.id`
- Queries asincrónicas a:
  - `products` table (nombre, imagen_principal, marca)
  - `product_variants` table (variantes disponibles)
- Agregación de:
  - Stock total
  - Precio mínimo/máximo
  - Costo logístico mínimo
- Exportado en el objeto de retorno del hook

### 2. `src/pages/seller/SellerCatalogo.tsx`

#### Estados Agregados
```typescript
const [productosAgrupados, setProductosAgrupados] = useState<ProductoConVariantes[]>([]);
const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
```

#### Efecto para Agrupación
```typescript
useEffect(() => {
  const agrupar = async () => {
    const agrupados = await groupByProduct();
    setProductosAgrupados(agrupados);
  };
  agrupar();
}, [items, groupByProduct]);
```

#### Función de Toggle
```typescript
const toggleExpanded = (productId: string) => {
  const newExpanded = new Set(expandedProducts);
  if (newExpanded.has(productId)) {
    newExpanded.delete(productId);
  } else {
    newExpanded.add(productId);
  }
  setExpandedProducts(newExpanded);
};
```

#### Nueva Estructura de Tabla

**Columnas de Producto Padre:**
- Expand/Collapse chevron
- Nombre del producto + marca (con imagen)
- Rango de precios (mín-máx)
- Costo de logística mínimo (con icono de camión)
- Stock total (badge)

**Filas de Variantes (cuando expandida):**
- Variantes compradas/importadas (fondo gris)
  - SKU, nombre
  - Precio de venta (verde)
  - **Costo de logística pagado** (badge azul) ⭐
  - Stock (con badge "sin stock" si aplica)
  
- Variantes disponibles en admin catalog (fondo verde claro)
  - SKU, nombre (texto verde)
  - Indicación "No importado"
  - Peso en kg (referencia)

### 3. Componentes Visuales Agregados

#### Icons
- `ChevronDown` / `ChevronRight`: Expand/collapse
- `Truck`: Indicador de costo de logística

#### Badges Coloridas
- Stock > 0: `variant="outline"`
- Stock = 0: Amber ("sin stock")
- Costo de logística: Azul (`bg-blue-50`)
- Variantes disponibles: Verde (`bg-green-50`)

#### Mensaje Informativo
```
"Haz clic en un producto para expandir y ver todas sus variantes, 
precios de logística pagados y opciones disponibles del catálogo."
```

## Flujo de Datos

```
useSellerCatalog(showAll=true)
  ↓
items (seller_catalog con todas las compras/importes)
  ↓
groupByProduct()
  ├─ Agrupa por sourceProductId
  ├─ Fetch product data (nombre, imagen, marca)
  ├─ Fetch product_variants (opciones disponibles)
  └─ Calcula agregaciones (stock, precios, costos)
  ↓
ProductoConVariantes[]
  ↓
SellerCatalogo muestra:
├─ Producto Padre (expandible)
│  ├─ Nombre, marca, imagen
│  ├─ Rango de precios
│  ├─ Logística mínima
│  └─ Stock total
└─ Si expandida:
   ├─ Variantes compradas (con costoLogistica)
   └─ Variantes disponibles en admin (referencia)
```

## Cambios en Visualización

### Antes (Vista Plana)
- Una fila por item
- Columnas: Producto, Costo Base, Precio, Margen, Stock, Estado, Acciones
- No visible: Costo de logística
- No agrupado: Múltiples variantes del mismo producto como filas separadas

### Después (Vista Jerárquica)
- Producto padre -> click expand -> Variantes
- Columnas: [expand], Producto, Precios Rango, Logística, Stock
- **Visible: Costo de logística por variante** ⭐
- **Agrupado: Mismo producto = 1 fila padre**
- **Referencia: Variantes disponibles del admin**

## URLs Relacionados

- **SellerCatalogo**: `/seller/catalogo` (showAll=true)
- **SellerInventarioB2C**: `/seller/inventario` (showAll=false, filtrado)
- **Database**: seller_catalog tabla con costoLogistica

## Próximas Mejoras Posibles

1. **Acciones en variantes:** Permitir editar precio/stock desde fila de variante
2. **Importación rápida:** Click en variante disponible → importar directamente
3. **Filtros avanzados:** Por marca, precio, logística, etc.
4. **Sorting:** Por precio, stock, logística
5. **Búsqueda mejorada:** En variantes también

## Notas de Implementación

- `expandedProducts` es un `Set<string>` para O(1) lookups
- `groupByProduct()` es `useCallback` para optimizar re-renders
- Agregación se recalcula cada vez que `items` cambia
- Los `keys` son: `product-${idx}-${productId}` para evitar duplicados
- Variantes dentro usan `variant-${id}` y `available-${id}` como keys

## Testing Manual

### Para Verificar Agrupación:
1. Compra 2+ variantes del mismo producto en catálogo B2B
2. Completa la orden
3. Ve a `/seller/catalogo`
4. Verifica que aparezcan bajo 1 fila padre
5. Expande → ve todas las variantes compradas
6. Verifica costo de logística en cada variante

### Para Verificar Variantes Disponibles:
1. Busca product que tiene variantes en admin catalog
2. Expande en SellerCatalogo
3. Mira debajo (fondo verde) → "Variantes disponibles en Catálogo Admin"
4. Verifica que tenga peso_kg si aplica

### Para Verificar Filtrado:
1. Busca en el search box
2. Filtra por nombre o SKU de variantes
3. Verifica que productos padre se muestren si variantes coinciden

