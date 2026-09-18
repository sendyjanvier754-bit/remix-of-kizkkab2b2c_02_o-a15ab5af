# Búsqueda global tipo AliExpress / SHEIN / Alibaba

## Por qué no funciona hoy (verificado)

- En el buscador de escritorio (`Header.tsx`) el texto se guarda en un estado pero **no hay ninguna acción al pulsar Enter ni al hacer clic en la lupa**: nunca se navega ni se consulta la base. Solo funcionan la cámara y el micrófono.
- En móvil (`GlobalMobileHeader.tsx`) sí hay sugerencias y al enviar navega a `/productos?q=...`, pero **esa ruta no existe** en la aplicación, así que cae en la página de "no encontrado".
- La página de resultados actual (`/busqueda`) **no busca nada**: solo muestra la lista que le pasa la búsqueda por imagen. Si se entra directo o se recarga, sale vacía.
- El buscador B2B (`HeaderB2B.tsx`) solo filtra la pantalla donde está; no hace búsqueda global.

## Qué vamos a construir

Una búsqueda única y coherente en toda la plataforma, que entienda el contexto del usuario:

- **Catálogo B2C** (comprador o vista cliente): busca en los productos publicados por tiendas.
- **Catálogo B2B** (vendedor, mayorista, admin): busca en el catálogo mayorista.
- El mismo cuadro busca **productos, tiendas y categorías**.

### 1. Página de resultados real
Una sola página `/busqueda?q=...` que:
- lee el texto desde la dirección (se puede compartir y recargar el enlace),
- muestra pestañas: **Productos · Tiendas · Categorías**, cada una con su contador,
- resultados paginados con scroll infinito y esqueletos de carga,
- filtros laterales: categoría, rango de precio, orden (relevancia, precio, novedad) y, en B2B, pedido mínimo,
- estado vacío con sugerencias y accesos a categorías populares,
- conserva los resultados de búsqueda por imagen que ya existen hoy.

### 2. Sugerencias mientras se escribe
Panel desplegable, igual en escritorio y móvil:
- productos coincidentes con imagen y precio,
- tiendas coincidentes,
- categorías coincidentes,
- historial de búsquedas recientes (guardado en el navegador) y sugerencias populares,
- Enter o clic en la lupa lleva a la página de resultados; clic en una sugerencia va directo al producto, la tienda o la categoría.

### 3. Unificación de los buscadores
El buscador de escritorio, el de móvil y el B2B pasan a usar el mismo componente y la misma lógica; el B2B mantiene además su filtrado dentro de la pantalla actual.

### 4. Redirección de compatibilidad
`/productos?q=...` redirige a `/busqueda?q=...` para que los enlaces antiguos no rompan.

## Detalles técnicos

- Nuevo hook `useGlobalSearch(query, { scope: 'b2c' | 'b2b', page, filters })` con React Query:
  - B2C: `seller_catalog` unido a `products` (activos), buscando por `nombre`, `descripcion_corta`, `sku_interno`.
  - B2B: `products` activos (`nombre`, `sku_interno`, descripción), respetando las reglas actuales de precio B2B.
  - Tiendas: `stores` activas por `name`/`slug`.
  - Categorías: filtrado sobre `useCategories` ya cargadas.
  - Consultas con `ilike` y término saneado (escape de `%`, `_`, `,`), `limit` y `range` para paginar.
- Nuevo hook `useSearchSuggestions(query)` con retardo de 250 ms y mínimo 2 caracteres.
- Nuevo componente `SearchBox` (entrada + panel de sugerencias + voz + cámara) reutilizado por `Header.tsx`, `GlobalMobileHeader.tsx` y `HeaderB2B.tsx`.
- `SearchResultsPage.tsx` reescrita: `useSearchParams` para `q`, `tab`, filtros; el modo imagen sigue leyendo `location.state`.
- El ámbito B2B/B2C se decide con el rol de `useAuth` y `ViewModeContext` (vista cliente fuerza B2C).
- Historial en `localStorage` (clave `recent_searches`, máximo 8).
- Textos con `useTranslation` (ES/EN/FR/HT) siguiendo las claves existentes de `header.*` y `common.*`.

## Fuera de alcance

- Búsqueda semántica o por IA (la búsqueda por imagen actual se mantiene tal cual).
- Cambios en los precios, el carrito o el checkout.
