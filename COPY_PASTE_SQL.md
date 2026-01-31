# 🎯 INSTRUCCIONES LISTAS PARA COPIAR Y PEGAR

## 📍 UBICACIÓN

Abre: https://app.supabase.com/project/fonvunyiaxcjkodrnpox/sql/new

(O en el dashboard de Supabase: SQL Editor → New Query)

---

## 🚀 EJECUTAR: Copia TODO esto en una sola query

```sql
-- ============================================
-- DYNAMIC PRICING VIEW - THE SOURCE OF TRUTH
-- Copia TODO esto a Supabase SQL Editor y RUN
-- ============================================

-- 1. ALTER TABLE - Renombrar columna
ALTER TABLE public.products 
RENAME COLUMN precio_mayorista TO precio_mayorista_base;

-- Agregar columnas de auditoría
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS last_fee_calculation JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ DEFAULT NULL;

-- 2. FUNCIÓN DE CÁLCULO
CREATE OR REPLACE FUNCTION public.calculate_b2b_price(
  p_product_id UUID,
  p_market_id UUID DEFAULT NULL,
  p_destination_country_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo_fabrica NUMERIC;
  v_costo_tramo_a NUMERIC := 0;
  v_costo_tramo_b NUMERIC := 0;
  v_fee_plataforma NUMERIC := 0;
  v_price_b2b NUMERIC;
  v_destination_country_id UUID;
  v_shipping_route_id UUID;
  v_weight_kg NUMERIC;
  v_weight_cbm NUMERIC;
  v_min_cost NUMERIC;
BEGIN
  SELECT costo_base_excel, weight_kg, COALESCE(width_cm, 0) * COALESCE(height_cm, 0) * COALESCE(length_cm, 0) / 1000000.0
  INTO v_costo_fabrica, v_weight_kg, v_weight_cbm
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_costo_fabrica IS NULL THEN
    RETURN 0;
  END IF;
  
  IF p_destination_country_id IS NOT NULL THEN
    v_destination_country_id := p_destination_country_id;
  ELSIF p_market_id IS NOT NULL THEN
    SELECT destination_country_id, shipping_route_id
    INTO v_destination_country_id, v_shipping_route_id
    FROM public.markets
    WHERE id = p_market_id;
  ELSE
    SELECT destination_country_id, shipping_route_id
    INTO v_destination_country_id, v_shipping_route_id
    FROM public.markets
    WHERE is_active = true
    LIMIT 1;
  END IF;
  
  IF v_shipping_route_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN COALESCE(cost_per_kg, 0) > 0 THEN GREATEST(cost_per_kg * COALESCE(v_weight_kg, 1), COALESCE(min_cost, 0))
        ELSE COALESCE(min_cost, 0)
      END
    INTO v_costo_tramo_a
    FROM public.route_logistics_costs
    WHERE shipping_route_id = v_shipping_route_id
      AND segment = 'china_to_transit'
      AND is_active = true
    LIMIT 1;
    
    v_costo_tramo_a := COALESCE(v_costo_tramo_a, 0);
  END IF;
  
  IF v_shipping_route_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN COALESCE(cost_per_kg, 0) > 0 THEN GREATEST(cost_per_kg * COALESCE(v_weight_kg, 1), COALESCE(min_cost, 0))
        ELSE COALESCE(min_cost, 0)
      END
    INTO v_costo_tramo_b
    FROM public.route_logistics_costs
    WHERE shipping_route_id = v_shipping_route_id
      AND segment = 'transit_to_destination'
      AND is_active = true
    LIMIT 1;
    
    v_costo_tramo_b := COALESCE(v_costo_tramo_b, 0);
  END IF;
  
  v_fee_plataforma := (v_costo_fabrica + v_costo_tramo_a + v_costo_tramo_b) * 0.12;
  v_price_b2b := v_costo_fabrica + v_costo_tramo_a + v_costo_tramo_b + v_fee_plataforma;
  
  RETURN ROUND(v_price_b2b::numeric, 2);
END;
$$;

-- 3. VISTA PRINCIPAL
CREATE OR REPLACE VIEW public.v_productos_con_precio_b2b AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  p.descripcion_corta,
  p.descripcion_larga,
  p.costo_base_excel,
  p.precio_mayorista_base,
  COALESCE(
    public.calculate_b2b_price(p.id, NULL, NULL),
    p.precio_mayorista_base,
    0
  ) AS precio_b2b,
  p.precio_sugerido_venta,
  p.precio_promocional,
  p.promo_active,
  p.promo_starts_at,
  p.promo_ends_at,
  p.moq,
  p.stock_fisico,
  p.stock_status,
  p.imagen_principal,
  p.galeria_imagenes,
  p.categoria_id,
  p.proveedor_id,
  p.origin_country_id,
  p.currency_code,
  p.url_origen,
  p.peso_kg,
  p.weight_kg,
  p.dimensiones_cm,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.is_oversize,
  p.shipping_mode,
  p.is_active,
  p.is_parent,
  p.created_at,
  p.updated_at,
  p.last_calculated_at
FROM public.products p
WHERE p.is_active = true;

-- 4. VISTA CON MERCADO
CREATE OR REPLACE VIEW public.v_productos_mercado_precio AS
SELECT
  p.id,
  p.sku_interno,
  p.nombre,
  public.calculate_b2b_price(p.id, m.id, m.destination_country_id) AS precio_b2b,
  p.costo_base_excel,
  p.precio_mayorista_base,
  p.stock_fisico,
  p.moq,
  p.imagen_principal,
  p.categoria_id,
  m.id AS market_id,
  m.name AS market_name,
  m.code AS market_code,
  m.currency AS market_currency,
  dc.id AS destination_country_id,
  dc.name AS destination_country_name,
  dc.code AS destination_country_code,
  p.created_at,
  p.updated_at
FROM public.products p
CROSS JOIN public.markets m
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
WHERE p.is_active = true AND m.is_active = true;

-- 5. VISTA PARA ADMIN (DESGLOSE)
CREATE OR REPLACE VIEW public.v_pricing_breakdown AS
SELECT
  p.id AS product_id,
  p.sku_interno,
  p.nombre,
  p.costo_base_excel AS costo_fabrica,
  (SELECT 
    COALESCE(cost_per_kg * COALESCE(p.weight_kg, 1), 0)
   FROM public.route_logistics_costs rlc
   WHERE rlc.shipping_route_id = m.shipping_route_id
     AND rlc.segment = 'china_to_transit'
     AND rlc.is_active = true
   LIMIT 1) AS costo_tramo_a,
  (SELECT 
    COALESCE(cost_per_kg * COALESCE(p.weight_kg, 1), 0)
   FROM public.route_logistics_costs rlc
   WHERE rlc.shipping_route_id = m.shipping_route_id
     AND rlc.segment = 'transit_to_destination'
     AND rlc.is_active = true
   LIMIT 1) AS costo_tramo_b,
  (p.costo_base_excel * 0.12) AS fee_plataforma,
  public.calculate_b2b_price(p.id, m.id, m.destination_country_id) AS precio_b2b_final,
  m.id AS market_id,
  m.name AS market_name,
  dc.name AS destination_country,
  NOW() AS calculated_at
FROM public.products p
CROSS JOIN public.markets m
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
WHERE p.is_active = true AND m.is_active = true;

-- 6. GRANT PERMISOS
GRANT SELECT ON public.v_productos_con_precio_b2b TO anon, authenticated;
GRANT SELECT ON public.v_productos_mercado_precio TO anon, authenticated;
GRANT SELECT ON public.v_pricing_breakdown TO authenticated;

-- 7. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_products_active_sku 
  ON public.products(is_active, sku_interno);

CREATE INDEX IF NOT EXISTS idx_products_category 
  ON public.products(categoria_id, is_active);

CREATE INDEX IF NOT EXISTS idx_markets_active 
  ON public.markets(is_active, destination_country_id);

CREATE INDEX IF NOT EXISTS idx_route_logistics_segment 
  ON public.route_logistics_costs(shipping_route_id, segment, is_active);

-- ✓ FIN - Si no ves errores en rojo, ¡todo funcionó!
```

---

## ✅ VERIFICACIÓN - Copia UNA de estas para probar

### Test 1: Ver si la vista existe
```sql
SELECT 
  id,
  sku_interno,
  nombre,
  precio_b2b,
  stock_fisico
FROM public.v_productos_con_precio_b2b
LIMIT 5;
```

### Test 2: Ver desglose de costos (Admin)
```sql
SELECT 
  sku_interno,
  nombre,
  costo_fabrica,
  costo_tramo_a,
  costo_tramo_b,
  fee_plataforma,
  precio_b2b_final
FROM public.v_pricing_breakdown
LIMIT 3;
```

### Test 3: Ver precios por mercado
```sql
SELECT 
  sku_interno,
  nombre,
  precio_b2b,
  market_name,
  destination_country_name
FROM public.v_productos_mercado_precio
LIMIT 5;
```

---

## 📋 CHECKLIST FINAL

- [ ] Copiar TODO el SQL anterior
- [ ] Ir a https://app.supabase.com/project/fonvunyiaxcjkodrnpox/sql/new
- [ ] Pegar todo el código
- [ ] Hacer clic en "RUN" (esquina superior derecha)
- [ ] Esperar a que termine (toma ~5-10 segundos)
- [ ] Verificar que NO hay errores en rojo
- [ ] (Opcional) Ejecutar uno de los tests de verificación arriba
- [ ] ✓ ¡Listo! Pasar a actualizar frontend

---

## 🎯 SIGUIENTE PASO

Una vez completado:
→ Leer: `DYNAMIC_PRICING_IMPLEMENTATION.md`
→ Actualizar servicios frontend según las instrucciones

