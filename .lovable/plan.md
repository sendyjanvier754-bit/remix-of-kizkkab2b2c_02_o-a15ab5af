

## Plan Consolidado: Ajustes de Precisión + Agrupación Producto/Variantes en Importación 1688

### Archivos a modificar
- `supabase/functions/process-1688-import/index.ts` — prompt actualizado
- `src/components/catalog/Import1688Dialog.tsx` — mapeo, precisión, agrupación

---

### 1. Edge Function `process-1688-import` — Actualizar prompt (líneas 55-59)

Reemplazar el system prompt actual con:
- **nombre**: "Traducción fiel y comercial del título original al español. No inventar nombres nuevos ni creativos."
- **variante_color**: "Traducir colores al español (ej: pink → Rosa). Mantener tallas y códigos de modelo exactamente igual."
- **variante_talla**: "Mantener tallas y códigos numéricos/alfanuméricos exactamente como están."
- **descripcion**: Eliminar límite de 200 caracteres. "Generar descripción detallada basada en el título del producto. PROHIBIDO usar comas — usar puntos; punto y coma o saltos de línea."

---

### 2. Import1688Dialog.tsx — Ajustes de mapeo y precisión

**a) Detección de columnas (líneas 82-91):**
- Agregar `"Inventario"` al array de keywords de stock
- Agregar `"Precio calculado"` ya está, agregar `"Precio calculado2"` explícitamente al inicio del array de price
- Agregar `"Imagen SKU"` al array de keywords de image

**b) Precisión de costo (línea 126):**
- Cambiar `costo: row[cols.price] || "0"` a:
  `costo: (row[cols.price] || "0").replace(/[^0-9.]/g, "")`
  Esto elimina US$, ¥, espacios pero preserva decimales exactos (3.63 → 3.63, nunca 3.6)

**c) Descripción en preview (línea 370):**
- Eliminar `max-w-[200px]` y usar tooltip o expandible para texto largo

---

### 3. Import1688Dialog.tsx — Agrupación Producto/Variantes

**Problema actual:** Cada fila se trata como producto independiente. Un archivo 1688 es un solo producto con N variantes.

**Solución:** Después de procesar las filas y traducir, agrupar usando la lógica existente de `useSmartProductGrouper`:

- Importar `groupProductsByParent`, `GroupedProduct`, `VariantRow` desde `@/hooks/useSmartProductGrouper`
- Tras traducción, agrupar por ID del producto 1688 (todas las filas con mismo ID = 1 producto padre con N variantes)
- **Preview actualizado**: Mostrar nombre del producto padre como encabezado, tabla de variantes debajo (Imagen, SKU, Color, Talla, Descripción, Costo, Stock)
- **Confirmación**: Al hacer clic en "Confirmar e Importar", construir `GroupedProduct[]` con:
  - `parentName`: nombre traducido
  - `baseSku`: ID 1688
  - `variants[]`: cada fila como `VariantRow` con `attributeValues: { color, talla }`
  - `detectedAttributes`: detectar automáticamente color (swatches) + talla (chips)
- Pasar este `GroupedProduct[]` al `SmartBulkImportDialog` pre-cargado

**Excel de descarga**: Mantener todas las filas (una por variante) para verificación manual.

