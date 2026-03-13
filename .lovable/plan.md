
## The Problem

`useSellerB2CSales` in `src/hooks/useOrders.ts` (line 100-145) queries **`orders_b2b`** with a metadata filter `order_type = 'b2c'`. This is architecturally wrong.

B2C sales — when a **user/client buys from a seller's published catalog** — are stored in the **`orders_b2c`** table (not `orders_b2b`), linked via `orders_b2c.store_id → stores.id → stores.owner_user_id = seller`.

The "Mis Ventas" tab also aggregates from `order.order_items_b2b` but B2C order items live in `order_items_b2c`, with fields: `product_name`, `sku`, `quantity`, `total_price`, `unit_price`.

`useB2CSalesStats` (line 569) has the same bug — it reads `orders_b2b`.

---

## Correct Data Path

```text
orders_b2c.store_id  →  stores.id  →  stores.owner_user_id = current seller
order_items_b2c.order_id → orders_b2c.id
order_items_b2c.seller_catalog_id → seller_catalog (product name, sku, images)
```

---

## What to Fix

### 1. `src/hooks/useOrders.ts` — `useSellerB2CSales`
Replace the `orders_b2b` query with a proper `orders_b2c` query:
- Get seller's `store.id` from `stores` where `owner_user_id = user.id`
- Query `orders_b2c` where `store_id = store.id`
- Include `order_items_b2c(*, seller_catalog(nombre, sku, images))` and buyer profile via `profiles!orders_b2c_buyer_user_id_fkey`
- Map result to the existing `Order` interface shape (so the rest of the page keeps working)

### 2. `src/hooks/useOrders.ts` — `useB2CSalesStats`
Same fix: query `orders_b2c` by `store_id` instead of `orders_b2b` by `seller_id` + metadata.

### 3. `src/pages/seller/SellerPedidosPage.tsx` — `productSales` useMemo
Change it to read from `order_items_b2c` fields (`quantity`, `total_price`, `product_name`) instead of `order_items_b2b` fields (`cantidad`, `subtotal`, `nombre`).

### 4. `src/pages/seller/SellerPedidosPage.tsx` — `getBuyerInfo`
B2C orders store the buyer address in `shipping_address` (JSON column) directly on `orders_b2c`, not in `metadata.shipping_address`. Update the helper to read from both correctly.

---

## Files to Edit

- `src/hooks/useOrders.ts` — fix `useSellerB2CSales` + `useB2CSalesStats`
- `src/pages/seller/SellerPedidosPage.tsx` — fix `productSales` aggregation to use B2C item fields

No DB changes needed — the tables already exist and are correct.
