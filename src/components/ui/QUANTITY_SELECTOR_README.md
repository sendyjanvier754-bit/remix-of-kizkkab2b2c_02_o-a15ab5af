# QuantitySelector Component

Un componente reutilizable para seleccionar cantidades de productos con botones de incremento/decremento.

## Ubicación
`src/components/ui/quantity-selector.tsx`

## Características

- ✅ Botones - y + con borde verde (estilo idéntico al diseño)
- ✅ Número centrado entre los botones
- ✅ Validación de valores mínimos y máximos
- ✅ Soporte para estados disabled
- ✅ Auto-guardado cuando se integra con hooks
- ✅ Diseño responsive y consistente

## Uso Básico

```tsx
import { QuantitySelector } from '@/components/ui/quantity-selector';

function MyComponent() {
  const [quantity, setQuantity] = useState(4);

  return (
    <QuantitySelector
      value={quantity}
      onChange={setQuantity}
      min={1}
      max={100}
    />
  );
}
```

## Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `value` | `number` | - | **Requerido**. Cantidad actual |
| `onChange` | `(value: number) => void` | - | **Requerido**. Callback cuando cambia la cantidad |
| `min` | `number` | `1` | Cantidad mínima permitida |
| `max` | `number` | `999999` | Cantidad máxima permitida |
| `disabled` | `boolean` | `false` | Deshabilita el selector |
| `className` | `string` | - | Clases CSS adicionales |

## Ejemplos de Uso

### En Carrito B2B (SellerCartPage)
```tsx
<QuantitySelector
  value={item.cantidad}
  onChange={(newQuantity) => {
    autoSaveUpdateQuantity(item.id, newQuantity);
  }}
  min={item.moq || 1}
  max={item.stockDisponible || 999999}
/>
```

### En Carrito B2C (CartPage)
```tsx
<QuantitySelector
  value={item.quantity}
  onChange={(newQuantity) => {
    updateQuantity(item.id, newQuantity);
  }}
  min={1}
  max={999999}
/>
```

### Con Cantidad Mínima (MOQ)
```tsx
<QuantitySelector
  value={quantity}
  onChange={handleQuantityChange}
  min={moq} // Minimum Order Quantity
  max={stockDisponible}
/>
```

## Validación

El componente valida automáticamente:
- No permite valores menores al mínimo (botón - deshabilitado)
- No permite valores mayores al máximo (botón + deshabilitado)
- Los botones se deshabilitan cuando se alcanzan los límites

## Integración con Auto-Save

Cuando se usa con `useAutoSaveCartWithShipping` (B2B):

```tsx
const { updateQuantity: autoSaveUpdateQuantity } = useAutoSaveCartWithShipping(
  selectedShippingTypeId,
  refetch
);

<QuantitySelector
  value={item.cantidad}
  onChange={(newQuantity) => {
    autoSaveUpdateQuantity(item.id, newQuantity);
  }}
/>
```

El componente actualiza la UI inmediatamente (optimistic update) y guarda a la base de datos automáticamente después de 500ms sin cambios.

## Diseño

El componente usa estilos que coinciden exactamente con el diseño proporcionado:
- Botones con `border-2 border-green-300`
- Altura y anchura: `h-8 w-8`
- Hover effect: `hover:bg-primary hover:text-primary-foreground`
- Transición suave: `transition-all duration-300`
- Iconos Lucide: `Minus` y `Plus` con `h-3 w-3`

## Accesibilidad

- ✅ Botones deshabilitados cuando se alcanza min/max
- ✅ Visual feedback en estados hover/disabled
- ✅ Indicador visual claro del valor actual

