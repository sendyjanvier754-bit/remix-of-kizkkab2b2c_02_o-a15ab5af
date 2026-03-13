-- Add FK from orders_b2c.buyer_user_id → profiles.id
-- This enables PostgREST to resolve the buyer_profile join in useSellerB2CSales.
-- Without this constraint the join causes a 400 error and no orders appear in Mis Ventas B2C.

ALTER TABLE public.orders_b2c
  ADD CONSTRAINT orders_b2c_buyer_user_id_fkey
  FOREIGN KEY (buyer_user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
