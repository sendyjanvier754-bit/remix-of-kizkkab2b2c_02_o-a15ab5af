

## Plan: Use Excel file name as product title (translated)

### Problem
The "Título Producto" column currently shows `group.parentName` which comes from the Excel's "nombre" column. The user wants it to show the **file name** of the Excel (e.g., `W_Rhinestone_Flat_Slippers_Diamond_Ladies_Shoes_Women_Slippers_618526722459_sku_list.csv`), cleaned and translated to Spanish.

### Changes in `src/components/catalog/Import1688Dialog.tsx`

**1. Add state for translated file title (~line 116):**
```ts
const [translatedFileTitle, setTranslatedFileTitle] = useState("");
```

**2. Extract and clean file name during `handleFile` (~line 145):**
Strip the extension, remove the numeric ID and `_sku_list` suffix, replace underscores with spaces:
```ts
const cleanTitle = file.name
  .replace(/\.(csv|xlsx?|tsv)$/i, "")
  .replace(/_?\d{10,}_sku_list$/i, "")
  .replace(/_/g, " ")
  .trim();
setTranslatedFileTitle(cleanTitle); // temporary until translated
```

**3. Translate the file title alongside the first batch (~after line 233):**
Send one extra translation request for the file name itself, and store the result in `translatedFileTitle`. This can be done by adding the clean file name as an extra item in the first batch call, or as a separate single-item call before the batch loop.

**4. Update `parentName` in grouped products and header to use `translatedFileTitle`:**
- In the group header (line 633): show `translatedFileTitle || cleanFileName` instead of `group.parentName`
- In the "Título Producto" column (line 675-676): same — show the translated file title
- In `convertToGroupedProducts` (line 419): set `parentName` to `translatedFileTitle`

### Result
- File `W_Rhinestone_Flat_Slippers_...csv` → cleaned to `W Rhinestone Flat Slippers Diamond Ladies Shoes Women Slippers` → AI translates → `"Pantuflas Planas de Diamante para Mujer"` → shown as product title everywhere

