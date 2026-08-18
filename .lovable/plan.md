# Vista móvil también en tabletas

Objetivo: que cualquier pantalla menor a 1024px (móviles y tabletas) vea exactamente la misma interfaz móvil en todo el sitio.

## Situación actual

- El hook `useIsMobile` ya usa 1024px, así que la lógica de componentes basada en JS ya trata las tabletas como móvil.
- El desajuste viene del CSS: las clases de Tailwind `sm:` (640px) y `md:` (768px) se activan en tabletas, mostrando variantes de escritorio (columnas múltiples, textos visibles, paddings grandes). Se usan en ~120 archivos con `md:` y ~84 con `sm:`.

## Cambio propuesto

Remapear los breakpoints de Tailwind en `tailwind.config.ts` para que `sm`, `md` y `lg` se activen todos a partir de 1024px:

```text
sm  -> 1024px
md  -> 1024px
lg  -> 1024px
xl  -> 1280px
2xl -> 1536px
```

Resultado: todo lo que hoy está escrito como `sm:`/`md:`/`lg:` deja de aplicarse por debajo de 1024px, por lo que tabletas y móviles comparten exactamente el mismo diseño, sin tener que editar los cientos de clases existentes en el código.

También se ajusta el objeto `container.screens` para mantener el ancho fluido con los nuevos valores.

## Verificación

Revisar con capturas a 390px (móvil), 768px y 1024px (tableta) y 1440px (escritorio) las pantallas clave: inicio, catálogo B2C, ficha de producto, carrito, checkout, perfil y panel admin, confirmando que 768px se ve igual que 390px y que el escritorio no cambia.

## Notas técnicas

- Un solo archivo modificado: `tailwind.config.ts` (sección `theme.screens` + `container.screens`).
- Los componentes que usan `useIsMobile` no requieren cambios.
- Efecto secundario esperado: móviles en horizontal (640–1023px) también mantendrán la vista móvil, que es el comportamiento deseado.
