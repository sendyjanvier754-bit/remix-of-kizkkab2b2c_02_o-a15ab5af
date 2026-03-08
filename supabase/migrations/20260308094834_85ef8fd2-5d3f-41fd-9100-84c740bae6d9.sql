
-- Fix: trg_update_po_totals must also fire on UPDATE (when master_po_id is set by the payment trigger)
DROP TRIGGER IF EXISTS trg_update_po_totals ON public.orders_b2b;

CREATE TRIGGER trg_update_po_totals
  AFTER INSERT OR UPDATE OF master_po_id, status, total_quantity, total_amount
  ON public.orders_b2b
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_totals_on_order_change();
