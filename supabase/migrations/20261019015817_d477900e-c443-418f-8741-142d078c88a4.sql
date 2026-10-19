CREATE TABLE public.sponsored_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement text NOT NULL DEFAULT 'category',
  seller_catalog_id uuid REFERENCES public.seller_catalog(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  amount_paid numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sponsored_placements_lookup ON public.sponsored_placements (placement, is_active);

GRANT SELECT ON public.sponsored_placements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsored_placements TO authenticated;
GRANT ALL ON public.sponsored_placements TO service_role;

ALTER TABLE public.sponsored_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view live sponsored placements" ON public.sponsored_placements
  FOR SELECT TO anon, authenticated
  USING (is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

CREATE POLICY "Admin and marketing manage sponsored placements" ON public.sponsored_placements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'marketing'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'marketing'::app_role));

CREATE OR REPLACE FUNCTION public.validate_sponsored_placement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.placement NOT IN ('category','trends','news') THEN
    RAISE EXCEPTION 'Invalid placement %', NEW.placement;
  END IF;
  IF NEW.seller_catalog_id IS NULL AND NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'A product is required';
  END IF;
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_sponsored_placement
BEFORE INSERT OR UPDATE ON public.sponsored_placements
FOR EACH ROW EXECUTE FUNCTION public.validate_sponsored_placement();