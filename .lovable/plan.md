
## Analysis

### Current behavior (broken)
1. **`PublishToB2CModal.tsx`** pre-fills prices using `variante.precio_original * 1.2` — a hardcoded 20% margin over B2B cost. It does NOT show or use `suggested_pvp_per_unit` from `v_business_panel_data`.
2. **`usePublishToB2C.ts`** sets `seller_catalog.precio_venta = 0` explicitly ("Se maneja a nivel de variante"), leaving the catalog-level price at zero.
3. **All marketplace hooks** (`useFeaturedProducts`, `useNewArrivals`, `useBestSellers`, `useAllSellerProducts`, etc.) read `seller_catalog.precio_venta` directly — so products appear with $0.
4. **`useStoreProducts`** in `useStore.ts` also reads `precio_venta` with no fallback.
5. **Validation gap**: `handleSubmit` only checks `selection.precio <= 0` but still allows publishing if variants with 0 prices are deselected — there's no gate that requires at least one variant with a valid price from the business panel perspective.

### What the user wants (the new rules)
1. **Always use the seller's actual set price** — no fallback arithmetic like `*1.2`, `*2.5`, `*3` on the frontend.
2. **Block publishing if any selected variant has no price** (already partial but needs to be clearer and use proper validation).
3. **Show the suggested PVP from `v_business_panel_data`** (field: `suggested_pvp_per_unit`) to the seller in the publish modal, as a reference/hint — so they know what to charge, not a forced value.
4. **`seller_catalog.precio_venta` must be set correctly** on publish (= minimum variant price), so marketplace queries work without fallbacks.

---

## Plan

### 3 changes across 3 files

---

### 1. `src/components/seller/PublishToB2CModal.tsx`

**Load business panel data for the product being published** by adding `useBusinessPanelData` (already exists in the codebase). For each variant, show `suggested_pvp_per_unit` as a reference hint (e.g., "PVP sugerido: $XX.XX") next to the price input — but the seller still types their own price.

**Change price pre-fill**: Instead of `precio_original * 1.2`, pre-fill with `suggested_pvp_per_unit` from the business panel. If the business panel returns null/0 (no market configured yet), leave the field empty/0 so the seller must fill it.

**Strengthen validation**: In `handleSubmit`, require that ALL selected variants have `precio_venta > 0`. The current check already does this (`selection.precio <= 0`) but the error message should be clearer: *"El precio de venta es obligatorio para publicar."*

```text
Changes in PublishToB2CModal.tsx:
- Import useBusinessPanelData
- Call useBusinessPanelData(item.product_id) inside the component
- In useEffect initializer: pre-fill precio with businessPanelData.suggested_pvp_per_unit
  (or keep 0 if null, forcing seller to enter a value)
- Show "PVP sugerido: $XX" hint below each price input (from suggested_pvp_per_unit)
- Validation: precio_venta must be > 0 for all selected variants before allowing publish
```

---

### 2. `src/hooks/usePublishToB2C.ts`

After writing all variants, compute `minVariantPrice = Math.min(...variantes.map(v => v.precio_venta).filter(p => p > 0))` and update `seller_catalog.precio_venta = minVariantPrice`.

This ensures `seller_catalog.precio_venta` is always a real positive number after publishing, so marketplace queries work immediately.

```text
Changes in usePublishToB2C.ts:
- After the variants loop, compute minVariantPrice from the variantes array
- Update seller_catalog.precio_venta = minVariantPrice  
- Remove the hardcoded precio_venta: 0 on insert — use minVariantPrice directly
```

---

### 3. DB migration — trigger + backfill

Add a PostgreSQL trigger `trg_sync_catalog_price` on `seller_catalog_variants` that auto-syncs `seller_catalog.precio_venta` to the minimum non-zero `precio_override` whenever variants are inserted or updated.

Also run a one-time backfill to fix existing records where `precio_venta = 0` but variants have prices.

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION sync_catalog_precio_venta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE seller_catalog
  SET precio_venta = COALESCE(
    (SELECT MIN(precio_override) FROM seller_catalog_variants
     WHERE seller_catalog_id = NEW.seller_catalog_id
       AND precio_override IS NOT NULL AND precio_override > 0),
    precio_venta
  )
  WHERE id = NEW.seller_catalog_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_catalog_price
AFTER INSERT OR UPDATE OF precio_override ON seller_catalog_variants
FOR EACH ROW EXECUTE FUNCTION sync_catalog_precio_venta();

-- One-time backfill
UPDATE seller_catalog sc
SET precio_venta = sub.min_price
FROM (
  SELECT seller_catalog_id, MIN(precio_override) as min_price
  FROM seller_catalog_variants
  WHERE precio_override IS NOT NULL AND precio_override > 0
  GROUP BY seller_catalog_id
) sub
WHERE sc.id = sub.seller_catalog_id
  AND (sc.precio_venta = 0 OR sc.precio_venta IS NULL);
```

No changes needed to `useMarketplaceData.ts` or `useStore.ts` — once `precio_venta` is always set correctly at the DB level, those queries work as-is.

---

## Files to edit

| File | Change |
|---|---|
| `src/components/seller/PublishToB2CModal.tsx` | Load business panel data, show `suggested_pvp_per_unit` as hint, pre-fill prices from it, require price > 0 |
| `src/hooks/usePublishToB2C.ts` | Set `precio_venta = minVariantPrice` on catalog insert/update (remove hardcoded `0`) |
| DB migration | Trigger + backfill to keep `seller_catalog.precio_venta` always in sync with variant prices |
