-- Permitir varias tiendas destacadas, cada una con su propia duración.
DROP POLICY IF EXISTS "Anyone can view trending store selection" ON public.trending_store_selection;
DROP POLICY IF EXISTS "Admin and marketing manage trending store selection" ON public.trending_store_selection;

ALTER TABLE public.trending_store_selection
  DROP CONSTRAINT IF EXISTS trending_store_selection_pkey,
  DROP CONSTRAINT IF EXISTS trending_store_selection_id_check;

ALTER TABLE public.trending_store_selection
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.trending_store_selection
  ALTER COLUMN id TYPE UUID USING gen_random_uuid(),
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DELETE FROM public.trending_store_selection
WHERE store_id IS NULL;

ALTER TABLE public.trending_store_selection
  ALTER COLUMN store_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trending_store_selection_store_id_key
  ON public.trending_store_selection(store_id);

ALTER TABLE public.trending_store_selection
  ADD CONSTRAINT trending_store_selection_pkey PRIMARY KEY (id);

CREATE POLICY "Anyone can view trending store selection"
  ON public.trending_store_selection FOR SELECT
  USING (true);

CREATE POLICY "Admin and marketing manage trending store selection"
  ON public.trending_store_selection FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'marketing'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'marketing'::public.app_role)
  );

GRANT SELECT ON public.trending_store_selection TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trending_store_selection TO authenticated;
