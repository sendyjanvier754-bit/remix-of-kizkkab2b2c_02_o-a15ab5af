ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_id_auth_users_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_auth_users_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stores_owner_profile_fkey') THEN
    ALTER TABLE public.stores ADD CONSTRAINT stores_owner_profile_fkey FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_account_deletion_blockers(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'open_purchases', (SELECT count(*) FROM orders_b2c WHERE buyer_user_id=_user_id AND status NOT IN ('delivered','completed','cancelled','refunded'))
                    + (SELECT count(*) FROM orders_b2b WHERE buyer_id=_user_id AND status NOT IN ('delivered','completed','cancelled','refunded')),
    'open_store_sales', (SELECT count(*) FROM orders_b2c o JOIN stores s ON s.id=o.store_id WHERE s.owner_user_id=_user_id AND o.status NOT IN ('delivered','completed','cancelled','refunded')),
    'has_store', EXISTS(SELECT 1 FROM stores WHERE owner_user_id=_user_id)
  )
  WHERE _user_id = auth.uid() OR public.has_role(auth.uid(),'admin');
$$;
GRANT EXECUTE ON FUNCTION public.get_account_deletion_blockers(uuid) TO authenticated;