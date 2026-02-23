-- ============================================================
-- TESTS: Logística Local — ejecutar cada bloque por separado
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TEST 0: Ver códigos reales de communes (ejecutar PRIMERO)
-- ─────────────────────────────────────────────────────────────
SELECT c.code, c.name, d.name AS department
FROM public.communes c
LEFT JOIN public.departments d ON d.id = c.department_id
WHERE c.is_active = true
ORDER BY d.name, c.name;

-- ─────────────────────────────────────────────────────────────
-- TEST 1: Port-au-Prince (code='PV'), 5 lb → espera $19.50
-- (2.50 × 5) + 5.00 + 2.00 = 19.50
-- ─────────────────────────────────────────────────────────────
SELECT * FROM public.calculate_local_logistics_cost(
  (SELECT id FROM public.communes WHERE code = 'PV' AND is_active = true LIMIT 1),
  5
);

-- ─────────────────────────────────────────────────────────────
-- TEST 2: Todas las communes ordenadas por costo para 10 lb
-- ─────────────────────────────────────────────────────────────
SELECT
  c.name                AS commune,
  d.name                AS department,
  c.rate_per_lb,
  c.delivery_fee,
  c.operational_fee,
  ROUND((c.rate_per_lb * 10) + COALESCE(c.delivery_fee,0) + COALESCE(c.operational_fee,0), 2) AS costo_10lb_usd
FROM public.communes c
LEFT JOIN public.departments d ON d.id = c.department_id
WHERE c.is_active = true
ORDER BY costo_10lb_usd;

-- ─────────────────────────────────────────────────────────────
-- TEST 3: Communes del departamento Ouest via función
-- ─────────────────────────────────────────────────────────────
SELECT * FROM public.get_communes_by_department(
  (SELECT id FROM public.departments WHERE name = 'Ouest' LIMIT 1)
);
-- Espera: Carrefour(KF), Croix-des-Bouquets(CX), Delmas(DL), Pétion-Ville(PT), Port-au-Prince(PV)

-- ─────────────────────────────────────────────────────────────
-- TEST 4: Todas las communes con datos completos (sin filtro)
-- ─────────────────────────────────────────────────────────────
SELECT * FROM public.get_communes_by_department(NULL);

-- ─────────────────────────────────────────────────────────────
-- TEST 5: Verificar que HAITI_HUB se insertó con hub_type correcto
-- ─────────────────────────────────────────────────────────────
SELECT id, name, code, hub_type, is_active
FROM public.transit_hubs
ORDER BY hub_type, name;
