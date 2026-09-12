-- Configuración de la tienda destacada en la página de tendencias.
CREATE TABLE IF NOT EXISTS public.trending_store_selection (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trending_store_selection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view trending store selection" ON public.trending_store_selection;
CREATE POLICY "Anyone can view trending store selection"
  ON public.trending_store_selection FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin and marketing manage trending store selection" ON public.trending_store_selection;
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
