

## Plan: Start at Step 1 (Subir) when opening SmartBulkImportDialog with preloaded 1688 data

### Problem
Line 185 in `SmartBulkImportDialog.tsx` sets `setStep('preview')` when preloaded products/file arrive from the 1688 import. This skips all intermediate steps (Subir, Mapear, Atributos, Activos) and jumps straight to the preview/confirm step.

### Fix

**File: `src/components/catalog/SmartBulkImportDialog.tsx` (line 185)**

Change `setStep('preview')` to `setStep('upload')` inside the preloaded data `useEffect`. This way:
- The preloaded file and products are stored in state (ready to use)
- The file appears as already loaded in the upload area
- The user confirms the upload, then proceeds through Mapear → Atributos → Activos → Confirmar normally

The file parsing logic (lines 158-182) still runs, populating `headers`, `rawData`, and `mapping` — so when the user clicks "Next" from the upload step, the mapping step will already be pre-filled.

### Single change
```
Line 185: setStep('preview')  →  setStep('upload')
```

