

## Plan: Fix PO linking — close expired PO only when new order arrives

### Problem
The `check_po_auto_close_thresholds` trigger fires on every PO totals update and checks both quantity AND time. When an order is linked to an expired-by-time PO, the totals update triggers auto-close in the same transaction — order ends up in a closed PO.

### Correct behavior
- A PO accumulates many orders normally
- PO closes by: quantity threshold, manual close, or cron
- **Time expiration** is only checked when a **new order arrives**: if the PO is expired, close it first, open a new one, link the order to the new one
- Orders already in the PO stay there when it closes (that's normal)

### Changes

#### 1. SQL Migration — Update `link_order_to_market_po_on_payment`
Before linking an order, check if the open PO's `cycle_start_at + time_interval_hours` has passed. If expired:
- Call `close_market_po_and_open_next(v_po_id, 'auto_time_expired')`
- Query for the new open PO
- Link the order to the **new** PO

This way the expired PO closes with all its existing orders intact, and the new order goes to a fresh PO.

#### 2. SQL Migration — Remove time check from `check_po_auto_close_thresholds`
Remove lines 44-52 (time threshold check). Keep only the quantity threshold check. This prevents the cascade where updating totals triggers a time-based close in the same transaction.

#### 3. Data fix — Move orphaned order to active PO
Using insert tool (data operation):
- `UPDATE orders_b2b SET master_po_id = (PO-CB-005 id) WHERE id = '90a31c1f...'`
- Recalculate totals for both PO-CB-004 and PO-CB-005

```text
Flow after fix:

  Order 1 arrives → PO-001 open, not expired → link to PO-001 ✓
  Order 2 arrives → PO-001 open, not expired → link to PO-001 ✓
  Order 3 arrives → PO-001 open, not expired → link to PO-001 ✓
  ... time passes, PO-001 expires ...
  Order 4 arrives → PO-001 open BUT expired → close PO-001 (keeps orders 1-3) → open PO-002 → link order 4 to PO-002 ✓
  Order 5 arrives → PO-002 open, not expired → link to PO-002 ✓
```

