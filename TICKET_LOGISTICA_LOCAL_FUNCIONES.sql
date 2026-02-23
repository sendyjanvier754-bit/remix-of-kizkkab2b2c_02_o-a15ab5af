-- ============================================================
-- TICKET #23: Función calculate_local_logistics_cost()
-- Calcula el costo de logística local para un carrito B2B
--
-- Fórmula confirmada con datos reales de communes:
--   costo = (rate_per_lb × peso_lb) + delivery_fee + operational_fee
--
-- Ejemplos reales:
--   Port-au-Prince 5 lb → (2.50×5) + 5.00 + 2.00 = $19.50
--   Cap-Haïtien   5 lb → (3.00×5) + 7.00 + 2.50 = $24.50
--   Cayes (Sud)   5 lb → (3.50×5) + 8.00 + 3.00 = $28.50
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN PRINCIPAL
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_local_logistics_cost(
  p_commune_id        UUID,
  p_peso_facturable_lb NUMERIC
)
RETURNS TABLE (
  costo_local_usd   NUMERIC,
  breakdown_json    JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commune         communes%ROWTYPE;
  v_department_name TEXT;
  v_costo_transporte NUMERIC;
  v_costo_total      NUMERIC;
BEGIN
  -- Validación básica
  IF p_commune_id IS NULL THEN
    RAISE EXCEPTION 'commune_id es requerido';
  END IF;
  IF p_peso_facturable_lb IS NULL OR p_peso_facturable_lb <= 0 THEN
    RAISE EXCEPTION 'peso_facturable_lb debe ser mayor que 0, recibido: %', p_peso_facturable_lb;
  END IF;

  -- Obtener datos de la commune
  SELECT * INTO v_commune
  FROM public.communes
  WHERE id = p_commune_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commune % no encontrada o no activa', p_commune_id;
  END IF;

  -- Nombre del departamento
  SELECT name INTO v_department_name
  FROM public.departments
  WHERE id = v_commune.department_id;

  -- Cálculo
  v_costo_transporte := v_commune.rate_per_lb * p_peso_facturable_lb;
  v_costo_total :=
    v_costo_transporte
    + COALESCE(v_commune.delivery_fee, 0)
    + COALESCE(v_commune.operational_fee, 0);

  RETURN QUERY SELECT
    ROUND(v_costo_total, 2) AS costo_local_usd,
    jsonb_build_object(
      'commune_id',       v_commune.id,
      'commune_name',     v_commune.name,
      'commune_code',     v_commune.code,
      'department',       v_department_name,
      'peso_lb',          p_peso_facturable_lb,
      'rate_per_lb',      v_commune.rate_per_lb,
      'costo_transporte', ROUND(v_costo_transporte, 2),
      'delivery_fee',     COALESCE(v_commune.delivery_fee, 0),
      'operational_fee',  COALESCE(v_commune.operational_fee, 0),
      'costo_total_usd',  ROUND(v_costo_total, 2),
      'formula',          format(
        '(%s × %s lb) + %s + %s = %s',
        v_commune.rate_per_lb,
        p_peso_facturable_lb,
        COALESCE(v_commune.delivery_fee, 0),
        COALESCE(v_commune.operational_fee, 0),
        ROUND(v_costo_total, 2)
      )
    ) AS breakdown_json;
END;
$$;

COMMENT ON FUNCTION public.calculate_local_logistics_cost(UUID, NUMERIC) IS
  'Calcula costo logístico local en USD. Entrada: commune_id + peso facturable en libras. Fórmula: (rate_per_lb × peso_lb) + delivery_fee + operational_fee';

GRANT EXECUTE ON FUNCTION public.calculate_local_logistics_cost(UUID, NUMERIC) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN AUXILIAR: obtener communes por departamento
-- Usada por el hook useAvailableLocalRoutes en el frontend
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_communes_by_department(
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  name                 TEXT,
  code                 TEXT,
  department_id        UUID,
  department_name      TEXT,
  rate_per_lb          NUMERIC,
  delivery_fee         NUMERIC,
  operational_fee      NUMERIC,
  extra_department_fee NUMERIC,
  transit_hub_id       UUID,
  hub_name             TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.code,
    c.department_id,
    d.name             AS department_name,
    c.rate_per_lb,
    c.delivery_fee,
    c.operational_fee,
    c.extra_department_fee,
    c.transit_hub_id,
    th.name            AS hub_name
  FROM public.communes c
  LEFT JOIN public.departments  d  ON d.id  = c.department_id
  LEFT JOIN public.transit_hubs th ON th.id = c.transit_hub_id
  WHERE c.is_active = true
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ORDER BY d.name, c.name;
END;
$$;

COMMENT ON FUNCTION public.get_communes_by_department(UUID) IS
  'Devuelve communes activas con datos de precios y hub asignado. p_department_id NULL = todas las communes.';

GRANT EXECUTE ON FUNCTION public.get_communes_by_department(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- TESTS DE VERIFICACIÓN (ejecutar separado después de deploy)
-- ─────────────────────────────────────────────────────────────

-- Test 1: Port-au-Prince, 5 lb → espera ~$19.50
-- SELECT * FROM public.calculate_local_logistics_cost(
--   (SELECT id FROM public.communes WHERE code = 'PAP' LIMIT 1), 5
-- );

-- Test 2: todas las communes con costo estimado para 10 lb
-- SELECT
--   c.name,
--   c.rate_per_lb,
--   (SELECT costo_local_usd FROM public.calculate_local_logistics_cost(c.id, 10)) AS costo_10lb
-- FROM public.communes c
-- WHERE c.is_active = true
-- ORDER BY costo_10lb;

-- Test 3: todas las communes del departamento Ouest
-- SELECT * FROM public.get_communes_by_department(
--   (SELECT id FROM public.departments WHERE code = 'OUE' LIMIT 1)
-- );
