

## Plan: Optimizar banner de tienda del seller en mobile

### Problema
El banner/card de perfil de la tienda ocupa demasiado espacio vertical en mobile. En desktop está bien.

### Cambios en `src/pages/StoreProfilePage.tsx`

1. **Reducir padding del contenido en mobile**: Cambiar `px-6 py-6` (línea 329) a usar padding reducido en mobile (`px-4 py-3 md:px-6 md:py-6`).

2. **Reducir tamaño del logo en mobile**: El logo ya tiene `w-20 h-20 md:w-28 md:h-28` (línea 334), lo reducimos a `w-14 h-14 md:w-28 md:h-28`.

3. **Reducir margen inferior del logo container**: `mb-4` (línea 331) a `mb-2 md:mb-4`.

4. **Compactar título**: El título `text-2xl md:text-3xl` (línea 348) lo reducimos a `text-xl md:text-3xl`.

5. **Compactar badges y stats en mobile**: Reducir `mb-3` a `mb-1.5 md:mb-3` en las secciones de badges (línea 375) y stats (línea 398).

6. **Compactar sección de Payment Methods en mobile**: Reducir `mt-8 pt-8` (línea 480) a `mt-4 pt-4 md:mt-8 md:pt-8`.

7. **Reducir gap en action buttons en mobile**: `gap-2` (línea 451) a `gap-1.5 md:gap-2`, y hacer los botones más compactos en mobile con `text-sm py-1.5`.

8. **Layout horizontal para botones en mobile**: Convertir los 3 botones (Seguir, Contactar, Compartir) en una fila horizontal en mobile para ahorrar espacio vertical.

Todos los cambios son condicionales con clases responsive de Tailwind, manteniendo el diseño actual en desktop intacto.

