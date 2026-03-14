

## Plan: Filter product query by seller store

### Problem
When navigating to `/producto/{sku}?seller={storeId}`, the `useProductBySku` hook ignores the `?seller=` param and just grabs the first matching SKU with `.limit(1)`. Since multiple sellers can have the same SKU, the wrong seller's product may be displayed.

### Fix
**File: `src/pages/ProductPage.tsx`**

1. **Pass `sellerParam` into `useProductBySku`** — add a third parameter `storeId`:
   ```typescript
   const useProductBySku = (sku, catalogId, storeId) => { ... }
   ```

2. **Filter by `seller_store_id` when available** — in the SKU query (line ~93-102), add `.eq("seller_store_id", storeId)` when `storeId` is provided. Keep the `.limit(1)` fallback for when no seller param exists.

3. **Update the hook call** (line ~260):
   ```typescript
   const { data: product, isLoading } = useProductBySku(sku, catalogId, sellerParam);
   ```

4. **Move `searchParams` extraction before the hook call** — currently `sellerParam` is read at line ~263, after the hook call at line ~260. Need to reorder so `sellerParam` is available.

### Result
- With `?seller=X`: fetches the exact seller's product
- Without `?seller=`: fetches any matching seller's product (current behavior)

