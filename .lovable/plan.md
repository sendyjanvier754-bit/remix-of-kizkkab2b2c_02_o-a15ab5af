

## Plan: Fix Costo auto-detection and show translated name in preview

### Problem 1: Costo maps to "Precio" instead of "PrecioCalculado2"
The `autoDetect` function iterates **headers first**, so if "Precio" appears before "PrecioCalculado2" in the Excel, it matches "Precio" because `"Precio".includes("precio")` is true. Need to reverse the logic: iterate **keywords first** (priority order), then find matching header.

### Problem 2: Translated name not visible in preview
The preview table shows Color, Talla, Descripción but not the translated product name. The `group.parentName` in the header shows it, but it may not update visually until translation completes. Add a "Nombre Traducido" column to the variant table.

### Changes in `src/components/catalog/Import1688Dialog.tsx`

**Fix 1 — `autoDetect` function (line 90-92):**
Change logic to iterate keywords in priority order first, then find matching header:
```ts
const autoDetect = (headers: string[], keywords: string[]): string => {
  for (const k of keywords) {
    const match = headers.find((h) => h.toLowerCase() === k.toLowerCase());
    if (match) return match;
  }
  for (const k of keywords) {
    const match = headers.find((h) => h.toLowerCase().includes(k.toLowerCase()));
    if (match) return match;
  }
  return "";
};
```
This ensures "PrecioCalculado2" is found by exact match first before "Precio" can match via `includes`.

**Fix 2 — Preview table: add "Nombre" column (lines 633-668):**
Add a "Nombre" column after SKU showing `row.nombre` (the translated name). This makes the translation visible per-row.

