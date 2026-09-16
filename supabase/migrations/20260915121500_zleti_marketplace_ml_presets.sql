-- Add the complete Mercado Libre fee preset to databases where the base
-- marketplace migration was already applied.

UPDATE public.zleti_marketplace_fees f
SET name = 'Comisión Publicación Premium',
    updated_at = now()
FROM public.zleti_marketplaces m
WHERE f.marketplace_id = m.id
  AND lower(m.name) = lower('Mercado Libre')
  AND m.currency = 'MXN'
  AND lower(f.name) = lower('Comisión de venta')
  AND f.value = 19.5;

INSERT INTO public.zleti_marketplace_fees (marketplace_id, name, fee_type, value, apply_to, sort_order)
SELECT m.id, preset.name, 'percentage', preset.value, 'sale_price', preset.sort_order
FROM public.zleti_marketplaces m
CROSS JOIN (VALUES
  ('Comisión Publicación Premium'::text, 19.5::numeric, 0),
  ('Retención ISR'::text, 2.5::numeric, 1),
  ('Retención IVA'::text, 8::numeric, 2)
) AS preset(name, value, sort_order)
WHERE lower(m.name) = lower('Mercado Libre')
  AND m.currency = 'MXN'
  AND NOT EXISTS (
    SELECT 1
    FROM public.zleti_marketplace_fees f
    WHERE f.marketplace_id = m.id
      AND lower(f.name) = lower(preset.name)
  );
