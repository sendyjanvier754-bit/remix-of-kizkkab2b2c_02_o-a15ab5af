

## Plan: Clean product names and use as base for descriptions

### Problem
Product names from 1688 Excel files contain underscores (`_`) instead of spaces (e.g., `"Vestido_elegante_mujer"`). These should be cleaned before translation and description generation.

### Changes in `src/components/catalog/Import1688Dialog.tsx`

**1. Clean name during processing (line ~215):**
When extracting the name from the mapped column, replace underscores with spaces:
```ts
const rawName = (row[cols.nombre] || "").replace(/_/g, " ").trim();
```
Apply this to both `nombre` and `nombre_original` fields in the `processed` row construction.

**2. No other changes needed** — the edge function `process-1688-import` already receives the title from `nombre_original` and generates the description based on it. With the cleaned name (no underscores), the AI translation and description generation will work correctly since it receives a proper readable title.

### Result
- `"Vestido_elegante_mujer"` → `"Vestido elegante mujer"` → AI translates and generates description from this clean name
- Single line change in the processing logic

