

## Plan: Vista Cliente como navegacion B2C completa

### Problema actual
Cuando el seller activa "Vista Cliente", se le redirige forzosamente a su propia tienda. El objetivo es que pueda navegar libremente por todo el marketplace como un cliente B2C normal, comprando de cualquier seller.

### Cambios

**1. `src/contexts/ViewModeContext.tsx`**
- Eliminar la funcion `navigateToOwnStore` y toda la logica de redireccion al activar modo cliente
- Al activar "Vista Cliente": simplemente cambiar el estado a "client" y navegar al marketplace (`/marketplace`)
- Al desactivar: cambiar a "b2b" sin redirigir (comportamiento actual)
- Eliminar la dependencia de `supabase` (ya no se necesita buscar la tienda)

**2. Verificar `useSmartCart.ts`**
- Ya funciona correctamente: cuando `isClientPreview` es true, `isB2BUser` es false, lo que permite al seller usar el carrito B2C y comprar como cliente normal. No requiere cambios.

### Resultado
- El seller puede activar "Vista Cliente", ir al marketplace y comprar productos de otros sellers con precios B2C y carrito B2C
- Al volver a "Vista B2B", recupera su experiencia completa de seller

