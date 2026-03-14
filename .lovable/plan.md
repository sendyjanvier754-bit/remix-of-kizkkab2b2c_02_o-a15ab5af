

## Plan: Productos recomendados en carritos y cuenta + Paginacion en compras

### 1. Crear componente reutilizable `RecommendedProductsSection`
- Nuevo componente en `src/components/products/RecommendedProductsSection.tsx`
- Usa `useRecommendedProducts` de `useMarketplaceData.ts` con `productId=null, categoryId=null` para obtener productos aleatorios
- Muestra un grid de productos usando `ProductCard` con titulo "Productos recomendados"
- Props: `maxProducts` (default 12), `className`

### 2. Agregar productos recomendados al final del carrito B2C (`CartPage.tsx`)
- Importar `RecommendedProductsSection`
- Insertar despues de toda la lista de items del carrito (antes del cierre del contenedor principal)
- Visible en todas las pantallas (mobile, tablet, PC)

### 3. Agregar productos recomendados al final del carrito B2B (`SellerCartPage.tsx`)
- Mismo componente `RecommendedProductsSection`
- Insertar antes del cierre de `SellerLayout`
- Visible en todas las pantallas

### 4. Agregar productos recomendados en cuenta mobile/tablet (`UserProfilePage.tsx`)
- Insertar dentro de `MobileLayout` despues del boton "Cerrar Sesion" (linea ~213)
- Solo se muestra en el div `md:hidden` que ya envuelve `MobileLayout`, asi que solo aparece en mobile y tablets
- No se toca `DesktopLayout`

### 5. Paginacion en MyPurchasesPage
- Agregar estado `currentPage` con reset al cambiar `statusFilter`
- Items por pagina: 6 en mobile/tablet (`isMobile`), 8 en PC
- Paginar `allOrders` con slice
- Agregar componente `Pagination` existente al final de la lista de ordenes

### Archivos a modificar
- **Nuevo**: `src/components/products/RecommendedProductsSection.tsx`
- **Editar**: `src/pages/CartPage.tsx` — agregar seccion de recomendados al final
- **Editar**: `src/pages/seller/SellerCartPage.tsx` — agregar seccion de recomendados al final
- **Editar**: `src/pages/UserProfilePage.tsx` — agregar recomendados en MobileLayout
- **Editar**: `src/pages/MyPurchasesPage.tsx` — agregar paginacion con 6/8 items por pagina

