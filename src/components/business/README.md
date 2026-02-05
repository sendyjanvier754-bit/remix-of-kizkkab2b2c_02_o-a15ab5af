# BusinessPanel (p_negocio)

Componente reutilizable para mostrar métricas de negocio en transacciones B2B.

## Características

- **Inversión**: Muestra el costo total (precio_b2b × cantidad)
- **Venta Sugerida**: Calcula el ingreso potencial usando PVP sugerido
- **Ganancia Estimada**: Muestra profit y margen de ganancia
- **Ganancia por Unidad**: Detalle del profit por cada unidad vendida

## Uso

```tsx
import { BusinessPanel } from '@/components/business/BusinessPanel';

function MyComponent() {
  return (
    <BusinessPanel
      investment={394.00}      // Total que inviertes (precio B2B × qty)
      suggestedPricePerUnit={9.85}  // Precio sugerido de venta al público
      quantity={100}           // Cantidad de unidades
      compact={false}          // Opcional: versión compacta
      className=""             // Opcional: clases CSS adicionales
    />
  );
}
```

## Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `investment` | `number` | ✅ | Inversión total (precio_b2b × cantidad) |
| `suggestedPricePerUnit` | `number` | ✅ | Precio sugerido de venta unitario (PVP) |
| `quantity` | `number` | ✅ | Cantidad total de unidades |
| `compact` | `boolean` | ❌ | Mostrar versión compacta (default: false) |
| `className` | `string` | ❌ | Clases CSS adicionales |

## Cálculos

El componente calcula automáticamente:

1. **Inversión**: Lo que recibes como prop (precio_b2b × cantidad desde la vista)
2. **Venta Sugerida**: `suggestedPricePerUnit × quantity`
3. **Ganancia**: `(venta sugerida) - (inversión)`
4. **Margen %**: `((PVP - costo) / costo) × 100`
5. **Ganancia/Unidad**: `PVP - costo_unitario`

## Ejemplos de Uso

### En VariantDrawer (ya implementado)

```tsx
const businessSummary = useMemo(() => {
  if (!isB2BUser || totalQty === 0 || totalPrice === 0) return null;
  
  const investment = totalPrice; // Sum of variant prices × quantities
  const avgCostPerUnit = investment / totalQty;
  const suggestedPvpPerUnit = avgCostPerUnit * 2.5; // 150% markup
  
  return { investment, suggestedPvpPerUnit, quantity: totalQty };
}, [isB2BUser, totalQty, totalPrice]);

// En el JSX:
{businessSummary && (
  <BusinessPanel
    investment={businessSummary.investment}
    suggestedPricePerUnit={businessSummary.suggestedPvpPerUnit}
    quantity={businessSummary.quantity}
  />
)}
```

### En Carrito de Compras

```tsx
function CartSummary({ cartItems }) {
  const totalInvestment = cartItems.reduce((sum, item) => 
    sum + (item.precio_b2b * item.quantity), 0
  );
  
  const totalQuantity = cartItems.reduce((sum, item) => 
    sum + item.quantity, 0
  );
  
  const avgCostPerUnit = totalInvestment / totalQuantity;
  const suggestedPvp = avgCostPerUnit * 2.5;
  
  return (
    <BusinessPanel
      investment={totalInvestment}
      suggestedPricePerUnit={suggestedPvp}
      quantity={totalQuantity}
    />
  );
}
```

### En Páginas de Órdenes

```tsx
function OrderDetails({ order }) {
  return (
    <BusinessPanel
      investment={order.total_amount}
      suggestedPricePerUnit={order.suggested_pvp_per_unit}
      quantity={order.total_quantity}
      compact={true}  // Versión compacta para listados
    />
  );
}
```

## Fórmulas de Negocio

### Precio B2B (desde vista)
```
precio_b2b = (costo_base × 4.0) × 1.12
```

### Precio Sugerido de Venta (PVP)
```
PVP = precio_b2b × 2.5
```

Esto da un margen de ~150% sobre el costo B2B.

### Ejemplo Completo

Producto con costo base de $0.88:

1. **Precio B2B**: $0.88 × 4.0 × 1.12 = **$3.94**
2. **PVP Sugerido**: $3.94 × 2.5 = **$9.85**
3. **Ganancia por unidad**: $9.85 - $3.94 = **$5.91**
4. **Margen**: ($5.91 / $3.94) × 100 = **150%**

Si compras 100 unidades:
- **Inversión**: $3.94 × 100 = **$394.00**
- **Venta Sugerida**: $9.85 × 100 = **$985.00**
- **Ganancia Estimada**: $985.00 - $394.00 = **$591.00**

## Notas

- El componente no muestra nada si `quantity <= 0`
- Todos los cálculos se hacen en el componente basados en las props
- Usa `compact={true}` para versiones reducidas en listados
- El precio sugerido es solo una recomendación, el vendedor puede ajustarlo
