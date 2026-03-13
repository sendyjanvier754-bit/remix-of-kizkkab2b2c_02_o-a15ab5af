

## Problem: Sellers Cannot See B2C Orders — Missing RLS Policies

### Root Cause

The `orders_b2c` table has RLS policies that only allow:
- **Admins** to view all orders
- **Buyers** to view their own orders (`buyer_user_id = auth.uid()`)

There is **no policy allowing sellers to view orders for their store** (`store_id` matching their store). The frontend code in `useSellerB2CSales` correctly queries by `store_id`, but RLS silently returns zero rows.

The same problem exists on `order_items_b2c` — sellers can't see order items either.

### Fix: Add RLS Policies for Sellers

**1. Add SELECT policy on `orders_b2c` for store owners:**
```sql
CREATE POLICY "Store owners can view their store b2c orders"
ON public.orders_b2c FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders_b2c.store_id
      AND stores.owner_user_id = auth.uid()
  )
);
```

**2. Add UPDATE policy on `orders_b2c` for store owners** (needed for status updates):
```sql
CREATE POLICY "Store owners can update their store b2c orders"
ON public.orders_b2c FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders_b2c.store_id
      AND stores.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = orders_b2c.store_id
      AND stores.owner_user_id = auth.uid()
  )
);
```

**3. Add SELECT policy on `order_items_b2c` for store owners:**
```sql
CREATE POLICY "Store owners can view their store b2c order items"
ON public.order_items_b2c FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders_b2c
    JOIN stores ON stores.id = orders_b2c.store_id
    WHERE orders_b2c.id = order_items_b2c.order_id
      AND stores.owner_user_id = auth.uid()
  )
);
```

### No Frontend Code Changes Needed

The seller hook (`useSellerB2CSales`) already correctly fetches the store by `owner_user_id` and filters orders by `store_id`. Once RLS allows the reads, orders will appear automatically.

