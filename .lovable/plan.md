# Revisión humana de traducciones 1688

## Objetivo

Insertar una **segunda etapa** en el flujo `Importar 1688`, entre la carga del Excel de origen y la generación del Excel final. En esa etapa la IA propone traducciones (título + descripción) para cada idioma del mercado seleccionado, un admin las corrige/aprueba campo por campo, y sólo entonces se genera el Excel final con los textos aprobados.

## Flujo de usuario (nuevo)

```text
1. Admin → /admin/catalogo → Importar 1688
2. Sube Excel origen  ─────────────────┐
3. Selecciona MERCADO (define idiomas) │  Etapa 1: Extracción (existente, se preserva)
4. IA traduce a los idiomas del mercado│
                                       ▼
5. Se crea un "Import Batch" en BD con estado draft
   Cada producto × idioma × campo (title|description) = fila con status = pending_approval
                                       ▼
6. Etapa 2 NUEVA: Panel de Revisión
   - Lista de productos del batch
   - Editor lado a lado: Original (ZH) | IA | Editado
   - Checkbox "Aprobar" por campo/idioma
   - Guarda edited_text, approved_by, approved_at
                                       ▼
7. Botón "Generar Excel final"
   - Habilitado siempre; usa texto aprobado donde exista
   - Los pendientes se marcan en el Excel para que el humano vea qué falta
   - Registra generated_by / generated_at en el batch
```

## Cambios de base de datos (Supabase)

Nuevas tablas en `public`:

- **`import_batches`**: un lote por cada Excel subido.
  - `market_id`, `source_filename`, `status` (draft | in_review | exported | archived), `created_by`, `total_products`, `languages` (jsonb array de códigos), `last_exported_at`, `exported_by`.
- **`import_batch_products`**: un producto del lote.
  - `batch_id`, `row_index`, `source_product_id_1688`, `sku`, `image_url`, `source_title_zh`, `source_description_zh`, `raw_payload` (jsonb con todo lo original: variantes, precios, etc.).
- **`import_batch_translations`**: la unidad de aprobación (por campo × idioma).
  - `batch_product_id`, `language_code` (es|en|fr|ht|…), `field` ('title' | 'description'), `ai_text`, `edited_text` (nullable, si difiere), `status` ('pending_approval' | 'approved' | 'rejected'), `approved_by`, `approved_at`, `notes`.
  - Índice único `(batch_product_id, language_code, field)`.

Todas con RLS: sólo `admin` (via `has_role(auth.uid(),'admin')`) puede leer/escribir. `GRANT` estándar a `authenticated` y `service_role`. Triggers `updated_at`.

Idiomas del mercado: se leen de `markets` / `market_destination_countries` existentes (ya usados por el sistema i18n). El admin selecciona un mercado en la Etapa 1 y eso determina qué filas de `import_batch_translations` se crean.

## Cambios en Edge Functions

- **`process-1688-import`** (existente): se refactoriza para aceptar `target_languages: string[]` y devolver traducciones por idioma. Sigue usando `google/gemini-3-flash-preview` vía Lovable AI Gateway (regla del proyecto).
- **`create-import-batch`** (nueva): recibe filas parseadas del Excel + market_id, llama a `process-1688-import` en tandas, inserta `import_batches` + `import_batch_products` + `import_batch_translations` (todo `pending_approval`).
- **`export-import-batch`** (nueva): dado un `batch_id`, arma el Excel final usando `edited_text ?? ai_text` sólo para filas `approved`. Marca `status = exported`, guarda `exported_by`/`last_exported_at`.

Todas con `verify_jwt = false` + validación manual de JWT y rol admin (regla del proyecto: CORS con preflight y `x-supabase-client-*`).

## Cambios de frontend

- **`Import1688Dialog.tsx`**: se convierte en un wizard de 2 pasos.
  1. **Paso 1 – Cargar**: Excel + selector de mercado. Al continuar, llama a `create-import-batch` (muestra progreso por chunks). Al terminar, redirige al panel de revisión con el `batch_id`.
  2. Se elimina la generación directa del Excel desde este diálogo.

- **Nueva ruta `/admin/catalogo/1688/revision/:batchId`** (`Import1688ReviewPage.tsx`):
  - Tabla de productos del lote con progreso `X / Y campos aprobados`.
  - Al seleccionar un producto: panel expandible con **una fila por (idioma, campo)**:
    - Columna 1: Original (ZH, read-only)
    - Columna 2: IA (read-only)
    - Columna 3: Editable (`Textarea` para descripción, `Input` para título) prellenado con `edited_text ?? ai_text`
    - Checkbox `Aprobar` → llama a Supabase para setear `status='approved' + approved_by=auth.uid() + approved_at=now() + edited_text`.
  - Botones globales: `Aprobar todo el visible`, `Generar Excel final`.
  - `Generar Excel final`: llama a `export-import-batch`, descarga el archivo, y muestra cuántos productos fueron incluidos totalmente vs. parcialmente. Si hay campos sin aprobar, el Excel los marca con prefijo `[PENDIENTE]` para que el humano los corrija en la próxima ronda.

- **`AdminCatalogo.tsx`**: sección nueva "Lotes 1688 en revisión" con listado (badge de pendientes) para volver a cada batch.

## Trazabilidad

Cada `import_batch_translations` guarda `approved_by` (uuid) + `approved_at` (timestamptz). Cada `import_batches` guarda `created_by`, `exported_by`, `last_exported_at`. El panel muestra `Aprobado por Fulano · hace 3 min`.

## Fuera de alcance

- No se toca `SmartBulkImportDialog` (import genérico) ni el resto del catálogo.
- No se automatiza publicación a `products`: el resultado final sigue siendo un Excel para el flujo actual.
- No se traducen variantes/atributos en esta versión (mismo comportamiento que hoy: variantes se traducen automáticamente sin revisión, sólo título y descripción entran a revisión — según pedido explícito).

## Detalles técnicos

- Chunking IA: 10 productos × llamada, `Promise.all` limitado a 3 concurrentes para no saturar el gateway (respeta 429).
- Idiomas por mercado: `SELECT languages FROM markets WHERE id = :market_id` (ya existe columna o se lee de `market_destination_countries.language`).
- El editor guarda con debounce 600ms; el checkbox `Aprobar` es explícito (no auto-aprueba al editar).
- Errores 429 / 402 del gateway se muestran con toast claro (rate limit / créditos).
