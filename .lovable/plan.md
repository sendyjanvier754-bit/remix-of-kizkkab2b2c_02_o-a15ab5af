

## Plan: Permitir que Sellers compren como clientes B2C

### Problema
Cuando un seller agrega un producto al carrito, siempre se enruta al carrito B2B (con MOQ y precios mayoristas). No pueden comprar productos de otros sellers como clientes finales.

### Solución
Usar el `ViewModeContext` existente (`isClientPreview`). Cuando el seller activa "Vista Cliente", tratarlo como usuario B2C en todo el flujo de carrito y compra.

### Cambios

**1. `src/hooks/useSmartCart.ts`**
- Importar `useViewMode`
- Cambiar la lógica de `isB2BUser`: si `isClientPreview` es true, forzar comportamiento B2C
- Resultado: `addToCart` usa carrito B2C y `getCartInfo` devuelve datos B2C cuando está en vista cliente

**2. `src/components/products/VariantDrawer.tsx`**
- Importar `useViewMode`
- Cuando `isClientPreview` es true: mostrar precios B2C, usar carrito B2C, ocultar calculadora de negocio

**3. Sin cambios en base de datos** — Las órdenes B2C ya usan `store_id` del producto y `buyer_user_id` acepta cualquier usuario autenticado.

### Flujo resultante
1. Seller activa "Vista Cliente" → navega marketplace como cliente → agrega al carrito B2C → compra como cliente final
2. Seller vuelve a vista B2B → experiencia mayorista con MOQ y precios wholesale
3. Las ventas se atribuyen correctamente al seller dueño del producto

