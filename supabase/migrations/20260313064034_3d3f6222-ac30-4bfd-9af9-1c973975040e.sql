
-- ============================================================
-- Trigger: sync seller_catalog.precio_venta from variants
-- ============================================================

-- Función que sincroniza precio_venta con el mínimo precio_override
CREATE OR REPLACE FUNCTION public.sync_catalog_precio_venta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.seller_catalog
  SET precio_venta = COALESCE(
    (SELECT MIN(precio_override)
     FROM public.seller_catalog_variants
     WHERE seller_catalog_id = NEW.seller_catalog_id
       AND precio_override IS NOT NULL
       AND precio_override > 0),
    precio_venta
  )
  WHERE id = NEW.seller_catalog_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger en seller_catalog_variants
DROP TRIGGER IF EXISTS trg_sync_catalog_price ON public.seller_catalog_variants;
CREATE TRIGGER trg_sync_catalog_price
AFTER INSERT OR UPDATE OF precio_override ON public.seller_catalog_variants
FOR EACH ROW EXECUTE FUNCTION public.sync_catalog_precio_venta();

-- ============================================================
-- Backfill: corregir registros existentes con precio_venta = 0
-- ============================================================
UPDATE public.seller_catalog sc
SET precio_venta = sub.min_price
FROM (
  SELECT seller_catalog_id, MIN(precio_override) AS min_price
  FROM public.seller_catalog_variants
  WHERE precio_override IS NOT NULL AND precio_override > 0
  GROUP BY seller_catalog_id
) sub
WHERE sc.id = sub.seller_catalog_id
  AND (sc.precio_venta IS NULL OR sc.precio_venta = 0);
