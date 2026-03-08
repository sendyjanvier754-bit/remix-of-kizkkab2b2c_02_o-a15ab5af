
CREATE OR REPLACE FUNCTION public.increment_popup_views(popup_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE marketing_popups
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = popup_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_popup_clicks(popup_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE marketing_popups
  SET clicks_count = COALESCE(clicks_count, 0) + 1
  WHERE id = popup_id;
$$;
