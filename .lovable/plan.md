## Plan: Refactorización Import1688Dialog — Mapeo Manual + Agrupación Inteligente

### Problema actual

1. Las columnas se auto-detectan sin dar opción al usuario de corregir el mapeo
2. La agrupación por `product_id` es manual y no usa `groupProductsByParent` del `useSmartProductGrouper`
3. No hay paso intermedio de mapeo de columnas como en SmartBulkImportDialog
4. El título se extrae directamente sin separar variantes del "Nombre del SKU"

### Archivos a modificar

- `src/components/catalog/Import1688Dialog.tsx` — refactorización completa
- `supabase/functions/process-1688-import/index.ts` — sin cambios (prompt ya actualizado)

---

### Cambios en Import1688Dialog.tsx

**Nuevo flujo de 4 pasos:** upload → mapping → preview → export

**Paso 1 — Upload (sin cambios)**
Drag & drop existente.

**Paso 2 — Mapping (NUEVO)**
Interfaz similar a SmartBulkImportDialog (líneas 380-403):

- Mostrar los headers detectados del archivo
- Select dropdowns para mapear cada campo Kizkka a una columna del Excel:
  - SKU_Interno ← sugerencia auto: "SKU ID"
  - Título Original ← sugerencia auto: "Nombre del SKU"
  - Costo ← sugerencia auto: "Precio calculado2"
  - Stock ← sugerencia auto: "Inventario"
  - URL_Imagen ← sugerencia auto: "Imagen SKU"
  - URL_Producto ← sugerencia auto: columna con "URL"
- Auto-detección inicial como sugerencia pero editable por el usuario
- Botón "Continuar" para proceder al preview

**Paso 3 — Preview con Traducción**

- Usar `groupProductsByParent` de `useSmartProductGrouper` en lugar de la agrupación manual actual
- Pasar las filas procesadas como `RawImportRow[]` con el mapping del usuario
- El SKU se construye con la columna mapeada a SKU_Interno (no hardcoded a "ID")
- Extraer título de la columna mapeada a "Título Original" (Nombre del SKU)
- Variantes: color y talla se extraen de las columnas detectadas como atributos por `groupProductsByParent` (misma lógica que SmartBulkImportDialog) valor directo de la columna mapeada 
- Costo: columna (Precio calculado2)`, "")` — sin redondeo
- Stock: valor directo de la columna mapeada
- Imagen: URL literal sin modificar
- Traducción por lotes via edge function (sin cambios)
- Tabla: Imagen (miniatura real), SKU, Nombre Traducido, Color, Talla, Costo Exacto, Stock, Descripción

**Paso 4 — Export & Confirm (sin cambios funcionales)**

- Descargar Excel con columnas Kizkka
- Confirmar para enviar `GroupedProduct[]` al SmartBulkImportDialog

### Detalle técnico de la agrupación

Reemplazar el `groupedProducts` memo actual (líneas 148-174) que agrupa por `product_id` con:

```
const { groups } = groupProductsByParent(rows, headers, mappingRecord, attributeColumns);
```

Esto usa `extractBaseSku` para detectar automáticamente qué filas son variantes del mismo producto (misma lógica que el importador inteligente), eliminando el problema de "cada fila = un producto".

### Mapeo de columnas — auto-detección sugerida

```
const auto1688Map = {
  sku_interno: find(["SKU ID", "ID"]),
  nombre: find(["Nombre del SKU", "标题", "Title"]),
  costo_base: find(["Precio calculado2", "Precio calculado"]),
  stock_fisico: find(["Inventario", "库存", "Stock"]),
  url_imagen: find(["Imagen SKU", "SKU图", "Image"]),
  url_origen: find(["URL", "链接"]),
};
```

El usuario puede corregir cualquier mapeo antes de continuar.