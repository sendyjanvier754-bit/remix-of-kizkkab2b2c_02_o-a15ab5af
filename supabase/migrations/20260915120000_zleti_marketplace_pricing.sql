-- ZleTI marketplace pricing configuration.
-- Supabase PostgREST exposes these tables as the marketplace REST API.

CREATE TABLE IF NOT EXISTS public.zleti_marketplaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD', 'MXN', 'EUR')),
  exchange_rate numeric(12, 6) NOT NULL DEFAULT 1
    CHECK (exchange_rate > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zleti_marketplace_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id uuid NOT NULL REFERENCES public.zleti_marketplaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  fee_type text NOT NULL DEFAULT 'percentage'
    CHECK (fee_type IN ('percentage', 'fixed')),
  value numeric(12, 4) NOT NULL DEFAULT 0 CHECK (value >= 0),
  apply_to text NOT NULL DEFAULT 'sale_price'
    CHECK (apply_to IN ('sale_price', 'landed_cost')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zleti_marketplaces_active_order
  ON public.zleti_marketplaces (is_active, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_zleti_marketplace_fees_marketplace_order
  ON public.zleti_marketplace_fees (marketplace_id, sort_order, created_at);

ALTER TABLE public.zleti_marketplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zleti_marketplace_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ZleTI marketplaces" ON public.zleti_marketplaces;
CREATE POLICY "Admins manage ZleTI marketplaces"
  ON public.zleti_marketplaces FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage ZleTI marketplace fees" ON public.zleti_marketplace_fees;
CREATE POLICY "Admins manage ZleTI marketplace fees"
  ON public.zleti_marketplace_fees FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.zleti_marketplaces (name, currency, exchange_rate, sort_order)
SELECT 'Mercado Libre', 'MXN', 18, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.zleti_marketplaces WHERE lower(name) = lower('Mercado Libre')
);

INSERT INTO public.zleti_marketplace_fees (marketplace_id, name, fee_type, value, apply_to, sort_order)
SELECT m.id, preset.name, 'percentage', preset.value, 'sale_price', preset.sort_order
FROM public.zleti_marketplaces m
CROSS JOIN (VALUES
  ('Comisión Publicación Premium'::text, 19.5::numeric, 0),
  ('Retención ISR'::text, 2.5::numeric, 1),
  ('Retención IVA'::text, 8::numeric, 2)
) AS preset(name, value, sort_order)
WHERE lower(m.name) = lower('Mercado Libre')
  AND NOT EXISTS (
    SELECT 1 FROM public.zleti_marketplace_fees f
    WHERE f.marketplace_id = m.id
      AND lower(f.name) = lower(preset.name)
  );

COMMENT ON TABLE public.zleti_marketplaces IS
  'Canales de venta configurables para calcular precios sugeridos ZleTI.';
COMMENT ON TABLE public.zleti_marketplace_fees IS
  'Cargos porcentuales o fijos asociados a un canal de venta ZleTI.';
