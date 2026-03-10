
## Full Picture

### Core problem: multi-vendor, orders_b2c, and build errors all in one sweep

The user wants:
1. **Fix all TypeScript build errors** (6 files, schema mismatch after Supabase connection)
2. **B2C cart & checkout fully functional** using `orders_b2c` / `order_items_b2c` tables (not `orders_b2b`)
3. **Multi-vendor correctness**: one product can be sold by multiple stores. The `b2c_cart_items` already carries `store_id` and `seller_catalog_id`. On checkout the order must be **split per store** — each store gets its own `orders_b2c` row with only its items.
4. **MyPurchasesPage** shows real B2C orders from `orders_b2c`
5. **Local logistics only** (no China→USA→Haiti chain)

### Key schema facts (from types.ts)
- `orders_b2c` columns: `buyer_user_id`, `store_id`, `subtotal`, `total_amount`, `shipping_cost`, `discount_amount`, `payment_method`, `payment_status`, `delivery_method`, `shipping_address` (JSON), `pickup_point_id`, `notes`, `payment_reference`
- `order_items_b2c` columns: `order_id`, `seller_catalog_id`, `sku`, `product_name`, `quantity`, `unit_price`, `total_price`, `variant_info`, `metadata`
- `orders_b2c.store_id` is a FK to `stores` → the order belongs to ONE store

### Multi-vendor split logic
Since `orders_b2c.store_id` is singular, and a B2C cart can have items from multiple stores, we must **group cart items by `store_id`** and create **one `orders_b2c` per store**. The `orders_b2c` table already has `store_id` for this exact purpose. The buyer pays once (total across all stores) but separate orders are created per vendor so each seller sees only their own orders.

### Build error fixes (all type-cast only)

| File | Fix |
|------|-----|
| `AgentProductSelector.tsx` L65, L82 | `as unknown as Product[]` / `as unknown as Variant[]` |
| `B2BCatalogImportDialog.tsx` L191-214 | Cast query result `as unknown as Array<{product_id,sku,id,price,...}>` |
| `useAddresses.ts` L64 | The insert type says `user_id` IS a known property — but `...input` spreads it AND it's set explicitly. Fix: remove explicit `user_id` from the spread OR build the object without spread. Best fix: cast whole insert `as any` or use a typed explicit object without spreading. |
| `useAutoSaveCartWithShipping.ts` L117 | `(supabase.rpc as any)('get_user_cart_shipping_cost', ...)` then cast `data as unknown as ShippingCost` |
| `useB2BPricingEngine.ts` L59, L76, L91 | `as unknown as ProductBasePrice[]` / `as unknown as ProductBasePrice` |
| `useB2BPricingEngineV2.ts` L45 | `p_address_id` → `p_shipping_zone_id`; property accesses on `data.valid`, `data.error`, `data.desglose` cast via `(data as any).valid` etc. Or cast `data as unknown as MultitramoPrice` etc. |
| `useB2BServices.ts` L119 | Same `p_address_id` → `p_shipping_zone_id`; `.desglose` accesses via `(data as any).desglose` |

### Phase 2 — Rewrite `useB2COrders.ts`

**`useCreateB2COrder`**: 
- Group `params.items` by `store_id`
- For each store group: insert one row into `orders_b2c` (with `buyer_user_id`, `store_id`, `subtotal`, `total_amount`, `shipping_cost`, `discount_amount`, `payment_method`, `payment_status`, `delivery_method`, `shipping_address`, `pickup_point_id`, `notes`, `payment_reference`)
- Insert `order_items_b2c` for each item in that group
- Return array of created orders (or primary order)

**`useActiveB2COrder`**: Query `orders_b2c` by `buyer_user_id` where `payment_status IN ('pending','pending_validation')`

**`useConfirmB2CPayment`**: Update `orders_b2c` not `orders_b2b`

**`useCancelB2COrder`**: Read from `orders_b2c` + `order_items_b2c`, cancel, restore items to `b2c_carts`

### Phase 3 — CheckoutPage.tsx

Replace the global logistics block (China→USA→Haiti section + `useLogisticsEngine` + `LocationSelector` + weight-based calculation) with:
- Keep **seller shipping options** (`useStoreShippingOptionsReadOnly`) — these are the local routes
- Add a simple shipping cost fallback: 0 (pickup) or store-configured flat rate
- Remove `shippingCalculation`, `communes`, `shippingRates`, `categoryRates` and all China/USA/Haiti JSX
- Remove `useLogisticsEngine` import
- Wire `shippingCost`, `discountAmount`, `notes`, `paymentReference` into `useCreateB2COrder` properly

The checkout keeps: delivery type selector, address management, pickup points, payment methods with admin-configured account details, discount code, order notes.

### Phase 4 — `MyPurchasesPage.tsx` + new `useBuyerB2COrders.ts`

Create `src/hooks/useBuyerB2COrders.ts`:
- Query `orders_b2c` joined with `order_items_b2c` by `buyer_user_id`
- Return typed list matching the page's display pattern

Update `MyPurchasesPage.tsx`:
- Import `useBuyerB2COrders`
- Merge B2C orders into the displayed list
- Show "B2C" / "Tienda" badge per order
- Use `product_name` from `order_items_b2c` (not `nombre` from `order_items_b2b`)

### Files to edit/create

```text
EDIT:
  src/components/agent/AgentProductSelector.tsx        build error cast
  src/components/seller/B2BCatalogImportDialog.tsx     build error cast
  src/hooks/useAddresses.ts                             build error fix
  src/hooks/useAutoSaveCartWithShipping.ts              build error cast
  src/hooks/useB2BPricingEngine.ts                      build error cast
  src/hooks/useB2BPricingEngineV2.ts                    p_address_id + Json casts
  src/hooks/useB2BServices.ts                           p_address_id + Json casts
  src/hooks/useB2COrders.ts                             all hooks → orders_b2c, multi-vendor split
  src/pages/CheckoutPage.tsx                            remove global logistics, wire local shipping
  src/pages/MyPurchasesPage.tsx                         add B2C orders display

CREATE:
  src/hooks/useBuyerB2COrders.ts                        new hook
```

No DB migrations needed — all tables already exist.

### Multi-vendor order detail

```
b2c_cart_items (buyer's cart):
  item_1: store_id=A, seller_catalog_id=x, product="Shirt"
  item_2: store_id=A, seller_catalog_id=y, product="Pants"
  item_3: store_id=B, seller_catalog_id=z, product="Shoes"

→ creates:
  orders_b2c row 1: buyer_user_id=buyer, store_id=A, total=shirt+pants
    order_items_b2c: item_1, item_2

  orders_b2c row 2: buyer_user_id=buyer, store_id=B, total=shoes
    order_items_b2c: item_3

Each store only sees their own order. Buyer's "mis compras" shows both rows.
```
