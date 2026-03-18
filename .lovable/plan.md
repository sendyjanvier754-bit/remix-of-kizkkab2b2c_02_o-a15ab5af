

## Plan: Fix Variante_1_Color in exported Excel

### Problems identified

1. **Line 363**: `Variante_1_Color: row.nombre` — uses the full product name instead of `row.variante_1_color`. This is a clear bug.

2. **AI translation prompt** (edge function): The prompt for `variante_color` says to keep complete variant descriptions. When the original 1688 data has color+size merged in one column (e.g., "钻石银 36"), the AI translates it as "Diamante plata 36" keeping the size number. We need to instruct the AI to strip trailing numeric size codes from variant1 if a separate variant2/size exists.

3. **Translated format**: The AI returns translations like "Pink Diamond (Diamante Rosa)" with original in parentheses. The prompt should instruct to return only the Spanish translation without the original text.

### Changes

**File 1: `src/components/catalog/Import1688Dialog.tsx` (line 363)**
- Change `Variante_1_Color: row.nombre` → `Variante_1_Color: row.variante_1_color`

**File 2: `supabase/functions/process-1688-import/index.ts` (line 57)**
- Update the `variante_color` prompt instruction to:
  - Return ONLY the Spanish translation, never include the original text in parentheses
  - If the color value ends with a number/size code that matches the variant2 value, strip it (return only the color/description part)

