

## Plan: Auto-load processed file in SmartBulkImportDialog + rename file

### What changes

**1. Rename downloaded Excel file (`Import1688Dialog.tsx` line 375)**
Change from `1688_procesado_2026-03-18.xlsx` to use `translatedFileTitle`:
```
{translatedFileTitle || cleanFileTitle || '1688_procesado'}_${date}.xlsx
```

**2. Pass the processed Excel data alongside grouped products**
Instead of only passing `GroupedProduct[]` to SmartBulkImportDialog, also generate and pass the processed Excel file as a `File` object so it can be auto-loaded in the upload step.

- In `Import1688Dialog.tsx` `handleConfirmImport`: build the Excel workbook in memory (same as `downloadExcel`) and create a `File` object from the blob. Pass it via a new callback prop or extend `onConfirmImport` to include the file.
- Update `Import1688DialogProps.onConfirmImport` signature to: `(groupedProducts: GroupedProduct[], processedFile: File) => void`

**3. Update AdminCatalogo.tsx to pass the file**
In the `onConfirmImport` handler, capture the file and pass it to SmartBulkImportDialog via a new `preloadedFile` prop.

**4. Update SmartBulkImportDialog to accept and auto-load the file**
- Add `preloadedFile?: File` prop
- In the `useEffect` that handles preloaded data (line 139-157): when `preloadedFile` is provided, parse it (same as the existing file upload logic), populate `rawData`, `headers`, `mapping`, auto-detect columns, and set step to `'mapping'` (or `'attributes'` if mapping is auto-detected) instead of skipping straight to `'preview'`
- Show the file name in the upload area as already loaded

This way the user sees the full import flow starting from the file being loaded, can verify mappings, configure attributes, process assets, then confirm.

### Files to modify
- `src/components/catalog/Import1688Dialog.tsx` — rename file, generate File object, updated callback
- `src/pages/admin/AdminCatalogo.tsx` — pass file to SmartBulkImportDialog
- `src/components/catalog/SmartBulkImportDialog.tsx` — accept `preloadedFile`, auto-parse it on open

