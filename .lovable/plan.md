## Plan: Modal Pre-procesamiento 1688 + Fix Build Errors

### 1. Fix Build Errors (2 archivos)

- `TrendingCategoryCard.tsx` línea 39: `translatedCategory.name` → `translatedCategory.translated.name`
- `CategoryProductsPage.tsx` línea 44: `translatedCategory.name` → `translatedCategory.translated.name`

### 2. Edge Function: `process-1688-import` (nueva)

Recibe títulos y variantes en chino, usa Lovable AI (`google/gemini-3-flash-preview`) para:

- Traducir título al español comercial
- Traducir colores/variantes al español
- Generar descripción ≤200 chars **sin comas**

### 3. Componente: `Import1688Dialog.tsx` (nuevo)

Modal con 3 pasos:

**Paso 1 — Drag & Drop**

- Zona de arrastrar archivos CSV/Excel
- `xlsx` con `raw: true` — todo como texto literal (URLs e imágenes intactos)

**Paso 2 — Preview con Traducción**

- Auto-detecta columnas 1688 (ID, Título, Variante 1/2, Imagen SKU, Precio calculado2, Stock)
- Genera `SKU_Interno` = `[ID]-[V1]-[V2]`
  &nbsp;
- Llama a `process-1688-import` por lotes para traducir
- Tabla: Imagen (renderizada), SKU_Interno, Nombre, Variante_1_Color, Variante_2_Talla, Descripción_Corta, Costo, Stock

**Paso 3 — Descarga y luego Confirmación (2 botones separados)**

Flujo secuencial con 2 acciones:

1. **Botón "Descargar Excel Procesado"** — genera y descarga el Excel con columnas Kizkka (SKU_Interno, Nombre, URL_Producto, Proveedor, Variante_1_Color, Variante_2_Talla, Descripcion_Corta, Costo, MOQ, Stock, URL_Imagen_Origen). Tras descargar, se habilita el segundo botón.
2. **Botón "Confirmar e Importar"** (deshabilitado hasta que se descargue) — muestra mensaje "¿Deseas enviar este archivo al proceso de importación?". Al confirmar: cierra el dialog 1688 y abre `SmartBulkImportDialog` con los datos pre-cargados.

### 4. Integración en AdminCatalogo

Agregar botón "Importar 1688" junto a los botones existentes. State `import1688Open` + renderizar `Import1688Dialog`.

### 5. Deploy

Agregar `process-1688-import` a `supabase/config.toml` y desplegar.

### Archivos

- `TrendingCategoryCard.tsx` — fix
- `CategoryProductsPage.tsx` — fix
- `src/components/catalog/Import1688Dialog.tsx` — nuevo
- `supabase/functions/process-1688-import/index.ts` — nuevo
- `supabase/config.toml` — agregar función
- `src/pages/admin/AdminCatalogo.tsx` — agregar botón