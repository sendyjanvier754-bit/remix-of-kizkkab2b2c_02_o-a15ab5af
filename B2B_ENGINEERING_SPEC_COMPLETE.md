# 🏗️ ESPECIFICACIÓN TÉCNICA - REINGENIERÍA B2B COMPLETA

**Versión**: 1.0 - Fase 1 (Motor de Precios + Checkout + PO)  
**Fecha**: 31 de Enero, 2026  
**Scope**: Exclusivamente B2B  
**Status**: Diseño detallado

---

## 📋 TABLA DE CONTENIDOS

1. [Arquitectura Global](#arquitectura-global)
2. [Motor de Precios B2B](#motor-de-precios-b2b)
3. [Sistema de Zonificación](#sistema-de-zonificación)
4. [Gestión de Productos](#gestión-de-productos)
5. [Checkout Dinámico](#checkout-dinámico)
6. [PO Maestra](#po-maestra)
7. [Plan de Implementación](#plan-de-implementación)

---

## 🏗️ ARQUITECTURA GLOBAL

### Stack Tecnológico

```
FRONTEND
├── React 18 + TypeScript
├── Componentes: ProductCard, CheckoutFlow, PODashboard
└── Hooks: useB2BPricing, useCheckoutLogistics, usePOMaster

BACKEND (PostgreSQL + Functions)
├── Motor de Precios: calculate_b2b_price_multitramo()
├── Gestión Logística: get_shipping_options_by_address()
├── Validaciones: validate_product_for_shipping()
└── PO Management: manage_po_master_cycle()

TABLAS BASE (Existentes - Extender)
├── products (agregar: weight_g, dimensions, is_oversize, is_sensitive)
├── shipping_routes (agregar: tier_standard, tier_express)
├── communes (extend: con zona y recargos)
└── route_logistics_costs (extend: por tramo y tipo)

TABLAS NUEVAS (Crear)
├── shipping_zones
├── shipping_tiers
├── product_sensitivities
├── master_purchase_orders
└── po_tracking_ids
```

---

## 💰 MOTOR DE PRECIOS B2B

### 1.1 Conversión Multitramo

```
┌─────────────────────────────────────────────────────────────┐
│ ENTRADA: peso_gramos = 2500g (producto en stock)            │
└────────────────────┬────────────────────────────────────────┘
                     ↓
        ┌────────────────────────────┐
        │ TRAMO A: China → USA (KG)  │
        │ Peso facturable:           │
        │ CEIL(2500 / 1000) = 3 KG  │
        │ Costo: 3 KG × $2.50 = $7.50│
        └────────────────────────────┘
                     ↓
        ┌────────────────────────────┐
        │ TRAMO B: USA → Haití (LB)  │
        │ Peso facturable:           │
        │ CEIL(2500 / 453.59) = 6 LB │
        │ Costo: 6 LB × $1.50 = $9   │
        └────────────────────────────┘
                     ↓
        ┌────────────────────────────┐
        │ FEES:                      │
        │ Platform Fee (12%)         │
        │ Surcharge (Sensible/Oversize)
        └────────────────────────────┘
                     ↓
        ┌────────────────────────────┐
        │ PRECIO ATERRIZADO:         │
        │ = Costo_Fabrica            │
        │ + Tramo_A ($7.50)          │
        │ + Tramo_B ($9)             │
        │ + Fees                     │
        │ + Recargo_Zona             │
        │ = PRECIO FINAL             │
        └────────────────────────────┘
```

### 1.2 Tabla: SHIPPING_TIERS

```sql
CREATE TABLE public.shipping_tiers (
  id UUID PRIMARY KEY,
  shipping_route_id UUID REFERENCES public.shipping_routes(id),
  tier_type ENUM ('standard', 'express'), -- Tipo de envío
  
  -- TRAMO A: China → Transit Hub
  tramo_a_cost_per_kg NUMERIC,
  tramo_a_min_cost NUMERIC,
  tramo_a_eta_min INT, -- días
  tramo_a_eta_max INT,
  
  -- TRAMO B: Transit Hub → Destination
  tramo_b_cost_per_lb NUMERIC,
  tramo_b_min_cost NUMERIC,
  tramo_b_eta_min INT,
  tramo_b_eta_max INT,
  
  -- Metadatos
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 1.3 Función: calculate_b2b_price_multitramo()

```sql
CREATE OR REPLACE FUNCTION public.calculate_b2b_price_multitramo(
  p_product_id UUID,
  p_address_id UUID,
  p_tier_type VARCHAR DEFAULT 'standard',
  p_quantity INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_address RECORD;
  v_route RECORD;
  v_tier RECORD;
  v_weight_g NUMERIC;
  v_weight_kg_facturable NUMERIC;
  v_weight_lb_facturable NUMERIC;
  v_volume_cm3 NUMERIC;
  v_cost_tramo_a NUMERIC;
  v_cost_tramo_b NUMERIC;
  v_cost_sensible NUMERIC := 0;
  v_cost_oversize NUMERIC := 0;
  v_cost_zone_surcharge NUMERIC := 0;
  v_cost_platform_fee NUMERIC;
  v_subtotal_logistics NUMERIC;
  v_final_price NUMERIC;
  v_eta_min INT;
  v_eta_max INT;
BEGIN
  -- 1. Obtener producto
  SELECT id, weight_kg, length_cm, width_cm, height_cm, 
         is_oversize, is_sensitive, costo_base_excel
  INTO v_product
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_product IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Producto no encontrado',
      'valid', false
    );
  END IF;
  
  -- 2. Convertir a gramos
  v_weight_g := COALESCE(v_product.weight_kg, 0) * 1000 * p_quantity;
  
  IF v_weight_g = 0 THEN
    RETURN jsonb_build_object(
      'error', 'Producto sin peso (oculto en catálogo)',
      'valid', false
    );
  END IF;
  
  -- 3. Obtener dirección y ruta
  SELECT dc.id AS country_id, c.id AS commune_id, c.zone_level, c.zone_surcharge
  INTO v_address
  FROM public.addresses a
  JOIN public.communes c ON a.commune_id = c.id
  JOIN public.destination_countries dc ON c.country_id = dc.id
  WHERE a.id = p_address_id;
  
  IF v_address IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Dirección no encontrada',
      'valid', false
    );
  END IF;
  
  -- 4. Obtener ruta y tier
  SELECT sr.*, st.*
  INTO v_route, v_tier
  FROM public.shipping_routes sr
  JOIN public.shipping_tiers st ON sr.id = st.shipping_route_id
  WHERE sr.destination_country_id = v_address.country_id
    AND st.tier_type = p_tier_type
    AND st.is_active = true
  LIMIT 1;
  
  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Sin cobertura logística en esta zona',
      'valid', false,
      'zone_level', v_address.zone_level
    );
  END IF;
  
  -- 5. Calcular peso facturable TRAMO A (Kg)
  v_weight_kg_facturable := CEIL(v_weight_g::NUMERIC / 1000.0);
  
  -- 6. Costo TRAMO A
  v_cost_tramo_a := GREATEST(
    v_weight_kg_facturable * v_tier.tramo_a_cost_per_kg,
    v_tier.tramo_a_min_cost
  );
  
  -- 7. Calcular peso facturable TRAMO B (Libras)
  v_weight_lb_facturable := CEIL(v_weight_g::NUMERIC / 453.59);
  
  -- 8. Costo TRAMO B
  v_cost_tramo_b := GREATEST(
    v_weight_lb_facturable * v_tier.tramo_b_cost_per_lb,
    v_tier.tramo_b_min_cost
  );
  
  -- 9. Recargos por tipo de producto
  IF v_product.is_oversize THEN
    v_volume_cm3 := (v_product.length_cm * v_product.width_cm * v_product.height_cm);
    v_cost_oversize := (v_volume_cm3 / 6000.0) * 0.15; -- Factor y recargo
  END IF;
  
  IF v_product.is_sensitive THEN
    v_cost_sensible := v_weight_g * 0.05; -- $0.05 por gramo sensible
  END IF;
  
  -- 10. Recargo por zona
  v_cost_zone_surcharge := COALESCE(v_address.zone_surcharge, 0);
  
  -- 11. Subtotal logística (sin fees)
  v_subtotal_logistics := v_cost_tramo_a + v_cost_tramo_b 
                         + v_cost_sensible + v_cost_oversize 
                         + v_cost_zone_surcharge;
  
  -- 12. Platform Fee (12%)
  v_cost_platform_fee := (v_product.costo_base_excel + v_subtotal_logistics) * 0.12;
  
  -- 13. Precio final aterrizado
  v_final_price := v_product.costo_base_excel + v_subtotal_logistics + v_cost_platform_fee;
  
  -- 14. ETA
  v_eta_min := v_tier.tramo_a_eta_min + v_tier.tramo_b_eta_min;
  v_eta_max := v_tier.tramo_a_eta_max + v_tier.tramo_b_eta_max;
  
  -- 15. Retornar resultado
  RETURN jsonb_build_object(
    'valid', true,
    'producto' , v_product.id,
    'cantidad', p_quantity,
    'peso_total_gramos', v_weight_g,
    'peso_facturable_kg', v_weight_kg_facturable,
    'peso_facturable_lb', v_weight_lb_facturable,
    'desglose', jsonb_build_object(
      'costo_fabrica', v_product.costo_base_excel,
      'tramo_a_china_usa_kg', v_cost_tramo_a,
      'tramo_b_usa_haiti_lb', v_cost_tramo_b,
      'recargo_sensible', v_cost_sensible,
      'recargo_oversize', v_cost_oversize,
      'recargo_zona', v_cost_zone_surcharge,
      'platform_fee_12pct', v_cost_platform_fee
    ),
    'precio_aterrizado', ROUND(v_final_price::NUMERIC, 2),
    'shipping_type', p_tier_type,
    'eta_dias_min', v_eta_min,
    'eta_dias_max', v_eta_max,
    'zone_level', v_address.zone_level
  );
END;
$$;
```

---

## 🗺️ SISTEMA DE ZONIFICACIÓN

### 2.1 Tabla: SHIPPING_ZONES

```sql
CREATE TABLE public.shipping_zones (
  id UUID PRIMARY KEY,
  country_id UUID REFERENCES public.destination_countries(id),
  zone_code VARCHAR UNIQUE,
  zone_name VARCHAR, -- "Capital", "Provincias", "Zona Remota"
  zone_level INT, -- 1=Capital, 2=Urbana, 3=Rural, 4=Muy Remota
  zone_surcharge NUMERIC DEFAULT 0, -- Recargo adicional por zona
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
);
```

### 2.2 Extender: COMMUNES

```sql
ALTER TABLE public.communes 
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.shipping_zones(id),
ADD COLUMN IF NOT EXISTS zone_surcharge NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_coverable BOOLEAN DEFAULT true;

-- Índice para performance
CREATE INDEX idx_communes_zone ON public.communes(zone_id, country_id);
```

---

## 📦 GESTIÓN DE PRODUCTOS

### 3.1 Extender tabla PRODUCTS

```sql
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS weight_g INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS dimensions_length_cm NUMERIC,
ADD COLUMN IF NOT EXISTS dimensions_width_cm NUMERIC,
ADD COLUMN IF NOT EXISTS dimensions_height_cm NUMERIC,
ADD COLUMN IF NOT EXISTS is_oversize BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sensitivity_type VARCHAR, -- 'liquid', 'battery', 'fragile'
ADD COLUMN IF NOT EXISTS volume_cm3_calculated NUMERIC GENERATED ALWAYS AS 
  (COALESCE(dimensions_length_cm, 0) * 
   COALESCE(dimensions_width_cm, 0) * 
   COALESCE(dimensions_height_cm, 0)) STORED;

-- Índice para ocultar productos sin peso
CREATE INDEX idx_products_weight ON public.products(weight_g) WHERE weight_g > 0;
```

### 3.2 Lógica de Restricción por Tipo

```
┌──────────────────────────────────────────────────────────┐
│ TIPO DE PRODUCTO  │ SHIPPING PERMITIDO                  │
├──────────────────┼───────────────────────────────────────┤
│ Normal           │ Standard, Express                    │
│ Oversize         │ Solo Standard (volumen cálc.)        │
│ Sensible         │ Standard + Express + Recargo +50%    │
│ Oversize+Sensible│ Solo Standard + Recargo +50%         │
│ Peso = 0         │ BLOQUEADO (no visible en B2B)        │
└──────────────────┴───────────────────────────────────────┘
```

### 3.3 Función: validate_product_for_shipping()

```sql
CREATE OR REPLACE FUNCTION public.validate_product_for_shipping(
  p_product_id UUID,
  p_tier_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_valid BOOLEAN := true;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  
  -- Validación 1: Peso no puede ser 0
  IF COALESCE(v_product.weight_g, 0) = 0 THEN
    v_valid := false;
    v_errors := array_append(v_errors, 'Producto sin peso - bloqueado en B2B');
  END IF;
  
  -- Validación 2: Oversize solo permite Standard
  IF v_product.is_oversize AND p_tier_type = 'express' THEN
    v_valid := false;
    v_errors := array_append(v_errors, 'Productos Oversize solo vía Standard');
  END IF;
  
  -- Validación 3: Dimensiones para Oversize
  IF v_product.is_oversize AND (
    v_product.dimensions_length_cm IS NULL OR
    v_product.dimensions_width_cm IS NULL OR
    v_product.dimensions_height_cm IS NULL
  ) THEN
    v_valid := false;
    v_errors := array_append(v_errors, 'Oversize requiere dimensiones completas');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', v_valid,
    'product_id', p_product_id,
    'tier_type', p_tier_type,
    'errors', v_errors
  );
END;
$$;
```

---

## 🛒 CHECKOUT DINÁMICO

### 4.1 Flujo de Estados

```
CHECKOUT FLOW (B2B):

1. SELECCIONAR PRODUCTOS
   └── Filtrar: weight_g > 0
   └── Mostrar: Precio Base (sin logística)

2. SELECCIONAR DIRECCIÓN
   └── Disparar: get_shipping_options_by_address()
   └── Mostrar: Standard vs Express
   └── Recalcular: Precio aterrizado (con logística)

3. SELECCIONAR TIPO ENVÍO
   └── Validar: validate_product_for_shipping()
   └── Actualizar: ETA, Peso facturable
   └── Mostrar: Desglose completo

4. REVISAR RESUMEN
   └── Subtotal Productos
   └── Logística (con breakdown)
   └── Recargos (Sensible/Oversize/Zona)
   └── Platform Fee
   └── TOTAL ATERRIZADO

5. CONFIRMAR → CREAR PO
   └── Generar ID con sufijos
   └── Pasar a estado "Preparing"
```

### 4.2 Componente React: CheckoutB2B.tsx

```typescript
// Pseudocódigo simplificado
interface CheckoutB2BProps {
  products: Product[];
  investor_id: UUID;
}

export function CheckoutB2B({ products, investor_id }: CheckoutB2BProps) {
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedTier, setSelectedTier] = useState<'standard' | 'express'>('standard');
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  // Dispara recálculo cuando cambia dirección
  const handleAddressChange = async (address: Address) => {
    setSelectedAddress(address);
    setLoading(true);
    
    // Call: get_shipping_options_by_address(address.id, products)
    const options = await supabase.rpc('get_shipping_options_by_address', {
      p_address_id: address.id,
      p_product_ids: products.map(p => p.id)
    });
    
    setShippingOptions(options);
    setLoading(false);
  };

  // Recalcula precio cuando cambia tier
  const handleTierChange = async (tier: 'standard' | 'express') => {
    setSelectedTier(tier);
    setLoading(true);
    
    // Call: calculate_b2b_price_multitramo() para cada producto
    const breakdown = await calculateTotalPrice(products, selectedAddress, tier);
    setPriceBreakdown(breakdown);
    setLoading(false);
  };

  return (
    <div className="checkout-b2b">
      <section>
        <h2>1. Dirección de Entrega</h2>
        <AddressSelector onChange={handleAddressChange} />
        {selectedAddress && (
          <p>{selectedAddress.street}, {selectedAddress.commune}</p>
        )}
      </section>

      {selectedAddress && (
        <section>
          <h2>2. Opciones de Envío</h2>
          <ShippingTierSelector 
            options={shippingOptions}
            selectedTier={selectedTier}
            onChange={handleTierChange}
          />
        </section>
      )}

      {priceBreakdown && (
        <section>
          <h2>3. Resumen del Pedido</h2>
          <PriceBreakdownDisplay breakdown={priceBreakdown} />
        </section>
      )}

      <button 
        onClick={() => createMasterPO(products, selectedAddress, selectedTier)}
        disabled={!priceBreakdown}
      >
        Confirmar y Crear PO
      </button>
    </div>
  );
}
```

### 4.3 Hook: useB2BCheckout.ts

```typescript
export function useB2BCheckout() {
  const [shippingCost, setShippingCost] = useState(0);
  const [estimatedDays, setEstimatedDays] = useState({ min: 0, max: 0 });

  const updateShippingByAddress = async (
    addressId: UUID,
    tier: 'standard' | 'express'
  ) => {
    const { data } = await supabase
      .rpc('get_shipping_cost_and_eta', {
        p_address_id: addressId,
        p_tier_type: tier
      });
    
    setShippingCost(data.shipping_cost);
    setEstimatedDays({ min: data.eta_min, max: data.eta_max });
  };

  return {
    shippingCost,
    estimatedDays,
    updateShippingByAddress
  };
}
```

---

## 📋 PO MAESTRA

### 5.1 Tabla: MASTER_PURCHASE_ORDERS

```sql
CREATE TABLE public.master_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR UNIQUE, -- [PAÍS-DEPTO-XXXXXX]
  country_id UUID REFERENCES public.destination_countries(id),
  commune_id UUID REFERENCES public.communes(id),
  investor_id UUID REFERENCES auth.users(id),
  
  -- Estados
  status VARCHAR DEFAULT 'open', -- open, preparing, shipped, delivered
  
  -- Metadata
  total_weight_g NUMERIC,
  total_weight_facturable_kg NUMERIC,
  total_weight_facturable_lb NUMERIC,
  total_items INT,
  total_shipping_cost NUMERIC,
  total_amount NUMERIC,
  
  -- Flags
  has_express BOOLEAN DEFAULT false,
  has_oversize BOOLEAN DEFAULT false,
  has_sensitive BOOLEAN DEFAULT false,
  
  -- Timeline
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  preparing_eta TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda rápida
CREATE INDEX idx_po_country_investor ON public.master_purchase_orders(country_id, investor_id, status);
```

### 5.2 Tabla: PO_TRACKING_IDS

```sql
CREATE TABLE public.po_tracking_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.master_purchase_orders(id),
  internal_id VARCHAR UNIQUE, -- [PAÍS-DEPTO-PO-HUB-XXXX-SUFFIX]
  
  -- Sufijos
  has_express BOOLEAN DEFAULT false,
  has_oversize BOOLEAN DEFAULT false,
  has_sensitive BOOLEAN DEFAULT false,
  
  -- Packing instruction
  packing_instruction VARCHAR, -- 'Standard Box', 'Special Packaging', 'Careful Handling'
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.3 Generar ID Maestro

```sql
CREATE OR REPLACE FUNCTION public.generate_po_tracking_id(
  p_po_id UUID
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po RECORD;
  v_country_code VARCHAR;
  v_commune_code VARCHAR;
  v_po_sequence INT;
  v_suffix VARCHAR := '';
  v_tracking_id VARCHAR;
BEGIN
  -- Obtener datos PO
  SELECT po.*, dc.code, c.code
  INTO v_po, v_country_code, v_commune_code
  FROM public.master_purchase_orders po
  JOIN public.destination_countries dc ON po.country_id = dc.id
  JOIN public.communes c ON po.commune_id = c.id
  WHERE po.id = p_po_id;
  
  -- Contar POs cerradas para secuencia
  SELECT COUNT(*) INTO v_po_sequence
  FROM public.master_purchase_orders
  WHERE country_id = v_po.country_id 
    AND closed_at IS NOT NULL;
  
  -- Construir sufijo
  IF v_po.has_express THEN
    v_suffix := v_suffix || '-EXP';
  END IF;
  IF v_po.has_oversize THEN
    v_suffix := v_suffix || '-OVZ';
  END IF;
  IF v_po.has_sensitive THEN
    v_suffix := v_suffix || '-SEN';
  END IF;
  
  -- Construir ID: [PAÍS-DEPTO-PO-HUB-XXXX]
  v_tracking_id := v_country_code || '-' || v_commune_code || '-PO-' 
                   || LPAD(v_po_sequence::VARCHAR, 4, '0') || v_suffix;
  
  RETURN v_tracking_id;
END;
$$;
```

### 5.4 Ciclo Perpetuo: Abrir Nueva PO

```sql
CREATE OR REPLACE FUNCTION public.close_po_and_open_new(
  p_po_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po RECORD;
  v_new_po_id UUID;
  v_tracking_id VARCHAR;
BEGIN
  -- Cerrar PO actual
  UPDATE public.master_purchase_orders
  SET status = 'preparing',
      closed_at = now()
  WHERE id = p_po_id;
  
  -- Obtener datos para nueva PO
  SELECT * INTO v_po FROM public.master_purchase_orders WHERE id = p_po_id;
  
  -- Crear nueva PO (abierta)
  INSERT INTO public.master_purchase_orders (
    country_id, commune_id, investor_id, status, opened_at
  ) VALUES (
    v_po.country_id, v_po.commune_id, v_po.investor_id, 'open', now()
  ) RETURNING id INTO v_new_po_id;
  
  -- Generar tracking ID
  v_tracking_id := public.generate_po_tracking_id(p_po_id);
  
  INSERT INTO public.po_tracking_ids (po_id, internal_id)
  VALUES (p_po_id, v_tracking_id);
  
  RETURN jsonb_build_object(
    'closed_po_id', p_po_id,
    'tracking_id', v_tracking_id,
    'new_po_id', v_new_po_id,
    'new_po_status', 'open'
  );
END;
$$;
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: BD (1 semana)
- [ ] Crear tablas: shipping_tiers, shipping_zones
- [ ] Extender: products, communes
- [ ] Crear funciones: calculate_b2b_price_multitramo()
- [ ] Crear funciones: validate_product_for_shipping()
- [ ] Crear funciones: generate_po_tracking_id()
- [ ] Testing SQL

### Fase 2: Backend Services (1 semana)
- [ ] Service: useB2BPricing.ts
- [ ] Service: useB2BCheckout.ts
- [ ] Service: usePOMaster.ts
- [ ] Endpoints RPC

### Fase 3: Frontend (2 semanas)
- [ ] Componente: CheckoutB2B.tsx
- [ ] Componente: ProductCardB2B.tsx (filtrado)
- [ ] Componente: PODashboard.tsx
- [ ] Componente: PriceBreakdownDisplay.tsx

### Fase 4: Testing & Optimization (1 semana)
- [ ] Testing unitario
- [ ] Testing E2E
- [ ] Performance tuning
- [ ] Validación con datos reales

---

## 📌 SIGUIENTES DOCUMENTOS

Después de este documento, se crearán:

1. **B2B_PRICING_ENGINE_DETAILED.md** - Motor de precios profundizado
2. **B2B_CHECKOUT_UI_GUIDE.md** - Diseño y componentes
3. **B2B_PO_MASTER_OPERATIONS.md** - Gestión de POs
4. **B2B_SQL_MIGRATIONS.sql** - Todas las tablas y funciones
5. **B2B_SERVICES_IMPLEMENTATION.ts** - Servicios React

---

**Status**: Especificación lista para desarrollo  
**Next**: Crear migraciones SQL detalladas

