
## Full Picture

The user has two requests:
1. **Fix all remaining build errors** (9 files: `useB2CCartItems.ts`, `useSiverMatch.ts`, `useStoreWithAlias.ts`, `useTrendingProducts.ts`, `useTrendingStores.ts`, `CheckoutPage.tsx`, `ProductPage.tsx`)
2. **New feature**: In the seller's inventory/publication flow, when a seller buys a product with variants (B2B), they should be able to **choose which specific variants to sell**, set individual prices per variant, set quantity per variant, and see variant images — the same experience as in B2B VariantDrawer

---

## Phase 1 — Fix remaining build errors

All are simple type-cast fixes, no logic changes:

| File | Error | Fix |
|------|-------|-----|
| `useB2CCartItems.ts:147` | `PostgrestFilterBuilder` not assignable to `Promise<any>` | Add `.then(() => {})` at end of `.update().eq()` chain |
| `useSiverMatch.ts:190,906` | Deep type instantiation + unknown RPC/table names | Wrap all `siver_match_*` selects in `(supabase as any)` and RPC calls in `(supabase as any).rpc(...)` |
| `useStoreWithAlias.ts:11,41,47,52` | `resolve_store_by_slug` + `store_slug_aliases` unknown | `(supabase as any).rpc('resolve_store_by_slug', ...)` cast to `string`; `(supabase as any).from('store_slug_aliases')` cast result |
| `useTrendingProducts.ts:20,40,52` | `get_trending_products` unknown RPC + `.length`/`.map` on Json | Cast `(supabase as any).rpc(...)` then `data as unknown as RpcRow[]` |
| `useTrendingStores.ts:83,87,105,236` | `is_anonymous` / `user_id` not on `store_reviews` | Remove `is_anonymous` from select, make `is_anonymous` optional in `StoreReview`, cast `data as unknown as StoreReview[]` |
| `CheckoutPage.tsx:1180` | `selectedCommune` undefined | Remove that condition — it was a global logistics variable. Button only needs `selectedAddress` for delivery method |
| `ProductPage.tsx:76,113,132,143` | `galeria_imagenes`, `costo_base_excel`, `category` not on strict type | Cast the supabase query result `as unknown as ProductQueryResult` inline type |

---

## Phase 2 — Seller variant management in the publication flow

### Current state
- `useInventarioB2C` fetches inventory from B2B orders (products the seller bought)  
- `PublicacionDialog` lets sellers set ONE price and toggle active/inactive for a single `SellerCatalogItem` (flat)  
- `usePublishToB2C` already handles multi-variant upsert into `seller_catalog_variants` (it loops over `variantes` array with `variant_id`, `sku`, `stock_a_publicar`, `precio_venta`)
- The SellerCatalog view (`v_seller_catalog_with_variants`) already groups products with their variants

### What's missing
The **"decide which variants to sell"** UI: a modal/drawer where the seller sees ALL variants they have in their inventory for a product (from `product_variants`), with images, colors, sizes, and per-variant controls for:
- Toggle: include this variant for sale or not
- Price field per variant  
- Quantity field (how many to publish, max = their purchased stock)

### Approach: Enhance `PublicacionDialog` into a full "Variant Management Panel"

Create a new component `VariantPublicationPanel` that:
1. Receives a `catalogId` (seller_catalog entry) + `sourceProductId`
2. Fetches `product_variants` for the source product (all admin-defined variants with images, color, size)
3. Fetches existing `seller_catalog_variants` for this catalog entry (what the seller already has configured)
4. Shows a list of variant rows:
   - Thumbnail image from `product_variants.images[0]`
   - Color swatch + size label from `attribute_combination`
   - Toggle "sell this variant" (enabled/disabled)
   - Price input (pre-filled from existing `seller_catalog_variants.precio_override` or `seller_catalog.precio_costo * 1.3`)
   - Stock input (pre-filled from `seller_catalog_variants.stock`, max = purchased qty)
5. On save: upsert `seller_catalog_variants` (insert new ones, update existing ones, set `is_available = false` for unchecked ones)

### Where this panel appears
- In `InventarioTable.tsx` (the seller inventory list), add an "Edit Variants" button per product row that opens this panel
- It replaces/augments the current `EditProductDialog` for products that have variants

### Files to edit/create

```text
FIX (build errors):
  src/hooks/useB2CCartItems.ts       — .then(() => {}) on update chain
  src/hooks/useSiverMatch.ts         — (supabase as any) on all siver queries + RPC
  src/hooks/useStoreWithAlias.ts     — (supabase as any).rpc + .from('store_slug_aliases')
  src/hooks/useTrendingProducts.ts   — (supabase as any).rpc + cast result
  src/hooks/useTrendingStores.ts     — remove is_anonymous from select, make optional in type
  src/pages/CheckoutPage.tsx         — remove selectedCommune reference
  src/pages/ProductPage.tsx          — cast producto query result as unknown

NEW FEATURE (variant management):
  src/components/seller/inventory/VariantPublicationPanel.tsx   — NEW: per-variant price/stock/toggle UI
  src/hooks/useSellerVariantPublication.ts                       — NEW: fetch + upsert logic
  src/components/seller/inventory/InventarioTable.tsx            — add "Gestionar variantes" button
```

---

## Variant Panel UI Design

```
┌──────────────────────────────────────────────────────┐
│  Gestionar variantes de venta              [X]       │
│  Camisa Algodón Premium                              │
│  Compraste 30 unidades • 3 variantes disponibles    │
├──────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────┐  │
│ │ [img]  Rojo / Talla S                    [✓]  │  │
│ │        Stock comprado: 10                      │  │
│ │        Publicar: [8_____] uds                  │  │
│ │        Precio:   [$15.00________]              │  │
│ └────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────┐  │
│ │ [img]  Azul / Talla M                    [✓]  │  │
│ │        Stock comprado: 12                      │  │
│ │        Publicar: [12____] uds                  │  │
│ │        Precio:   [$15.00________]              │  │
│ └────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────┐  │
│ │ [img]  Negro / Talla L                   [ ]  │  │ ← toggle off = no vender
│ │        Stock comprado: 8                       │  │
│ │        (deshabilitado)                         │  │
│ └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│              [Cancelar]  [Guardar cambios]           │
└──────────────────────────────────────────────────────┘
```

The data connection is:
- `seller_catalog_variants.variant_id` → `product_variants.id` (for images/attrs)  
- `seller_catalog_variants.stock` = how many the seller wants to publish (≤ purchased qty from B2B order)  
- `seller_catalog_variants.precio_override` = seller's B2C sale price for that variant  
- `seller_catalog_variants.is_available` = whether this variant is shown in B2C store
