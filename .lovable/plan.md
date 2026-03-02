

## Problem Analysis

There are **two separate issues** to address:

### Issue 1: Build Error in AdminLogisticsPage.tsx
Lines 100-104 contain orphaned destructuring code (`updateCategoryShippingRate, createShipmentTracking, generateHybridTrackingId, markLabelPrinted, } = useLogisticsEngine();`) that duplicates the already-existing destructuring at lines 71-84. This was likely left behind from a bad merge. Fix: remove lines 100-104 and add the missing properties to the existing destructuring at lines 71-84.

### Issue 2: Seller Catalog Product/Variant Consolidation

**Current State (broken)**:
- `seller_catalog` has **duplicate rows per product** (one per variant purchased, or one per order). Example: `source_product_id = 4a53679c` has 2 rows in `seller_catalog`.
- `seller_catalog_variants` table **exists** in the DB with correct schema (`id, seller_catalog_id, variant_id, sku, stock, precio_override, is_available, availability_status`).
- A trigger function `auto_add_to_seller_catalog_on_complete()` exists and **correctly** consolidates: 1 `seller_catalog` row per product, N `seller_catalog_variants` rows per variant. But the old data has duplicates from before the trigger was created.
- A view `v_seller_catalog_with_variants` exists in the DB that aggregates variants per product.
- The frontend `useSellerCatalog` hook does NOT use `seller_catalog_variants` at all -- it reads flat rows from `seller_catalog` and groups them client-side via `groupByProduct()` using `sourceProductId`.

**Target State (like Amazon/Alibaba)**:
- 1 `seller_catalog` row per unique product per seller store
- N `seller_catalog_variants` rows under each catalog entry (one per variant purchased)
- Stock lives on `seller_catalog_variants.stock`, NOT on `seller_catalog.stock`
- Frontend reads from the `v_seller_catalog_with_variants` view or queries `seller_catalog` + `seller_catalog_variants` joined

### Plan

**Step 1: Fix AdminLogisticsPage.tsx build error**
- Remove duplicate destructuring lines 100-104
- Add missing properties (`updateCategoryShippingRate, createShipmentTracking, generateHybridTrackingId, markLabelPrinted`) to the existing destructuring block at lines 71-84

**Step 2: Data cleanup migration**
- SQL migration to consolidate duplicate `seller_catalog` rows:
  - For each `(seller_store_id, source_product_id)` group with multiple rows, keep one canonical row and merge the others' data into `seller_catalog_variants`
  - Delete the duplicate `seller_catalog` rows
- Add a UNIQUE constraint on `seller_catalog(seller_store_id, source_product_id)` to prevent future duplicates

**Step 3: Add `seller_catalog_variants` to TypeScript types**
- Update `src/integrations/supabase/types.ts` to include the `seller_catalog_variants` table definition

**Step 4: Update `useSellerCatalog` hook**
- Change `fetchCatalog` to query `seller_catalog` joined with `seller_catalog_variants` (or use `v_seller_catalog_with_variants`)
- Stock = SUM of `seller_catalog_variants.stock` per product
- Each variant carries its own SKU, availability_status, stock
- Remove the client-side `groupByProduct` N+1 query pattern (currently makes individual `products` and `product_variants` queries per group)
- Update `SellerCatalogItem` and `ProductoConVariantes` interfaces to reflect variant-level data from `seller_catalog_variants`

**Step 5: Update seller catalog UI components**
- `MiCatalogTable.tsx` and `SellerMiCatalogoPage.tsx` already use `ProductoConVariantes` -- ensure they render variant data from the DB rather than from the flat grouping
- Stock updates should target `seller_catalog_variants` rows, not `seller_catalog.stock`

**Step 6: Verify trigger handles future orders correctly**
- The existing `auto_add_to_seller_catalog_on_complete()` trigger already follows the correct pattern (1 product row, N variant rows). Confirm it works with the unique constraint.

### Technical Details

```text
BEFORE (current):
seller_catalog
┌─────────┬──────────────────┬────────┐
│ id      │ source_product_id │ stock  │
├─────────┼──────────────────┼────────┤
│ row-1   │ product-A         │ 12     │  ← variant Negro-2XL
│ row-2   │ product-A         │ 25     │  ← variant Negro-3XL (DUPLICATE!)
└─────────┴──────────────────┴────────┘

AFTER (target):
seller_catalog                          seller_catalog_variants
┌─────────┬──────────────────┐         ┌──────────────┬────────────┬───────┐
│ id      │ source_product_id │         │ catalog_id   │ variant_id │ stock │
├─────────┼──────────────────┤         ├──────────────┼────────────┼───────┤
│ row-1   │ product-A         │   ──►  │ row-1        │ Negro-2XL  │ 12    │
│         │                   │         │ row-1        │ Negro-3XL  │ 25    │
└─────────┴──────────────────┘         └──────────────┴────────────┴───────┘
```

