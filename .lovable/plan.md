
# Plan: Reingeniería Completa del Sistema B2B

## Resumen Ejecutivo
Este plan implementa una reingeniería completa del sistema B2B, integrando un Motor de Precios avanzado con conversión de unidades multitramo, Checkout Dinámico con detección de ubicación, y Gestión de PO Maestra con identificadores híbridos.

---

## Fase 0: Corrección de Errores de Build (Prerequisito)

Antes de implementar la reingeniería, se deben corregir los errores de TypeScript existentes:

### Errores a Corregir
| Archivo | Error | Solución |
|---------|-------|----------|
| `useB2BServices.ts:6` | Import incorrecto de supabase | Cambiar a `@/integrations/supabase/client` |
| `useB2BServices.ts:395` | Tipo UUID incompatible | Agregar validación antes de asignar |
| `ProductPage.tsx:897` | `dynamicPrice` no declarado | Declarar variable con valor `null` por defecto |
| `SellerCatalogo.tsx:141,157,165` | Props faltantes en stats | Extender `getStats()` para incluir `totalProducts`, `totalStock`, `avgMargin` |
| `SellerInventarioB2C.tsx:19` | `storeId` no existe | Agregar `storeId` al hook `useSellerCatalog` |
| `SellerMarketingTools.tsx:51` | `storeId` no existe | Agregar `storeId` al hook `useSellerCatalog` |

---

## Fase 1: Motor de Precios B2B Multitramo

### 1.1 Nuevas Tablas de Base de Datos

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ESTRUCTURA DE DATOS                          │
├─────────────────────────────────────────────────────────────────┤
│  shipping_zones                                                 │
│  ├── id, country_id, zone_level (1-5), zone_name               │
│  ├── surcharge_percent, is_capital, is_remote                  │
│  └── coverage_active                                            │
├─────────────────────────────────────────────────────────────────┤
│  shipping_tiers                                                 │
│  ├── id, route_id, tier_type ('standard' | 'express')          │
│  ├── cost_per_kg_tramo_a, cost_per_lb_tramo_b                  │
│  ├── min_cost_a, min_cost_b                                    │
│  └── eta_min_days, eta_max_days, is_active                     │
├─────────────────────────────────────────────────────────────────┤
│  product_shipping_classes                                       │
│  ├── id, product_id, is_oversize, is_sensitive                 │
│  ├── sensitivity_type ('liquid' | 'battery' | 'fragile')       │
│  ├── oversize_surcharge_percent, sensitive_surcharge_per_g     │
│  └── allows_express, requires_special_packing                  │
├─────────────────────────────────────────────────────────────────┤
│  Extensión: products                                            │
│  └── + weight_g, length_cm, width_cm, height_cm, volume_factor │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Función RPC: calculate_b2b_price_multitramo

Lógica principal de cálculo:

```text
ENTRADA:
  - p_product_id: UUID del producto
  - p_address_id: UUID de dirección del usuario
  - p_tier_type: 'standard' | 'express'
  - p_quantity: Cantidad solicitada

PROCESO:
  1. CONVERSIÓN DE UNIDADES
     ├── peso_total_g = producto.weight_g × cantidad
     ├── peso_kg = peso_total_g / 1000  (Tramo A: China→USA)
     └── peso_lb = peso_total_g / 453.59 (Tramo B: USA→Haití)

  2. REDONDEO FACTURABLE (AGRUPADO)
     ├── peso_facturable_kg = MAX(1, CEIL(peso_kg))
     └── peso_facturable_lb = MAX(1, CEIL(peso_lb))

  3. DETECCIÓN DE ZONA
     ├── Obtener commune_id desde address
     ├── Obtener zone_level desde shipping_zones
     └── Si no existe ruta → ERROR: 'Sin cobertura logística'

  4. CÁLCULO POR TRAMOS
     ├── costo_tramo_a = MAX(min_cost_a, peso_facturable_kg × rate_kg)
     ├── costo_tramo_b = MAX(min_cost_b, peso_facturable_lb × rate_lb)
     └── recargo_zona = subtotal × zone.surcharge_percent

  5. RECARGOS ESPECIALES
     ├── IF oversize: volumen_cbm = L×W×H/1000000
     │   └── peso_volumetrico = volumen_cbm × volume_factor
     │   └── usar MAX(peso_real, peso_volumetrico)
     └── IF sensitive: recargo = peso_g × sensitive_surcharge_per_g

  6. PRECIO FINAL
     └── precio_aterrizado = costo_fabrica + tramo_a + tramo_b 
                           + recargo_zona + recargo_oversize 
                           + recargo_sensitive + platform_fee_12%

SALIDA:
  {
    valid: boolean,
    precio_aterrizado: number,
    precio_unitario: number,
    desglose: { costo_fabrica, tramo_a, tramo_b, recargos... },
    shipping_type: 'standard' | 'express',
    eta_dias_min, eta_dias_max,
    peso_real_g, peso_facturable_kg, peso_facturable_lb,
    zone_level, error?
  }
```

### 1.3 Hook: useB2BPricingEngineV2

Nuevo hook que extiende `useB2BPricingEngine` con:
- Conversión automática de unidades (g→kg, g→lb)
- Soporte para tiers (Standard/Express)
- Validación de productos (oversize, sensitive)
- Caché de cálculos por 5 minutos

---

## Fase 2: Detección de Ubicación y Zonificación

### 2.1 Estructura de Zonas

```text
PAÍS: Haití
├── Zona 1 (Capital): Puerto Príncipe - 0% recargo
├── Zona 2 (Metropolitana): Pétion-Ville, Delmas - 5% recargo
├── Zona 3 (Urbana): Cap-Haïtien, Gonaïves - 10% recargo
├── Zona 4 (Rural): Áreas rurales accesibles - 15% recargo
└── Zona 5 (Remota): Áreas de difícil acceso - 25% recargo
```

### 2.2 Función RPC: get_shipping_options_by_address

```text
ENTRADA: p_address_id

PROCESO:
  1. Obtener commune_id desde user_addresses
  2. Obtener zone_level desde shipping_zones
  3. Obtener rutas disponibles para el país
  4. Para cada ruta, obtener tiers (standard/express)
  5. Calcular costos base por tier
  6. Aplicar recargos de zona

SALIDA:
  Array de {
    route_id, route_name,
    tier_type, tier_name,
    base_cost, zone_surcharge, total_cost,
    eta_min, eta_max,
    is_available
  }
```

### 2.3 Vista: v_shipping_options_by_country

Vista materializada que precalcula opciones de envío por país/zona para consultas rápidas en el checkout.

---

## Fase 3: Interfaz de Checkout Dinámico

### 3.1 Componentes UI

```text
src/components/checkout/
├── B2BShippingSelector.tsx      # Selector Standard/Express
├── B2BAddressSelector.tsx       # Selector de dirección con recálculo
├── B2BOrderSummary.tsx          # Resumen con desglose transparente
├── B2BWeightBreakdown.tsx       # Peso Real vs Facturable
└── B2BCoverageAlert.tsx         # Alerta de sin cobertura
```

### 3.2 Componente: B2BShippingSelector

```text
┌─────────────────────────────────────────────────────────────────┐
│  Selecciona tu tipo de envío                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ ○ ESTÁNDAR              │  │ ○ EXPRESS                   │  │
│  │   Consolidado           │  │   Prioritario               │  │
│  │   $12.50 USD            │  │   $28.90 USD                │  │
│  │   15-25 días            │  │   7-12 días                 │  │
│  │   ✓ Productos sensibles │  │   ⚠ No oversize            │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Componente: B2BOrderSummary

```text
┌─────────────────────────────────────────────────────────────────┐
│  Resumen de tu Pedido                                           │
├─────────────────────────────────────────────────────────────────┤
│  Subtotal Productos (5 items)              $245.00              │
│  ─────────────────────────────────────────────────────────────  │
│  Envío Internacional                                            │
│    ├─ Tramo A (China→USA) [2.3 kg]         $18.40              │
│    └─ Tramo B (USA→Haití) [5.1 lb]         $25.50              │
│  Recargo Zona 3 (10%)                       $4.39              │
│  ─────────────────────────────────────────────────────────────  │
│  Peso Real: 2,150g │ Peso Facturable: 3 kg / 6 lb              │
│  ─────────────────────────────────────────────────────────────  │
│  Platform Fee (12%)                        $35.20              │
│  ═════════════════════════════════════════════════════════════  │
│  TOTAL A PAGAR                            $328.49 USD          │
│  Entrega estimada: 15-25 días                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Hook: useB2BCheckoutV2

Actualización del hook existente para:
- Recálculo reactivo al cambiar dirección
- Validación de productos por tier
- Optimización server-side via RPC
- Caché de resultados

---

## Fase 4: Gestión de Productos (Clasificación)

### 4.1 Lógica de Restricción

```text
CLASIFICACIÓN DE PRODUCTOS
├── STANDARD
│   ├── Permite: Express, Standard
│   └── Cálculo: peso_real × tarifa
│
├── OVERSIZE (> límites configurados)
│   ├── Permite: Solo Standard
│   ├── Cálculo: MAX(peso_real, peso_volumétrico) × tarifa
│   └── peso_volumétrico = (L × W × H) / volume_factor
│
├── SENSIBLE (líquidos, baterías, frágil)
│   ├── Permite: Express, Standard (con recargo)
│   ├── Cálculo: peso × tarifa + recargo_sensible
│   └── Packing: "Manejo Especial"
│
└── BLOQUEADO (peso = 0)
    └── Oculto en catálogo B2B
```

### 4.2 Función: validate_product_for_shipping

```text
ENTRADA: p_product_id, p_tier_type

VALIDACIONES:
  1. Peso > 0 (requerido)
  2. Si tier='express' y is_oversize=true → RECHAZAR
  3. Si is_sensitive=true → ADVERTIR recargo adicional
  4. Verificar stock disponible

SALIDA:
  { valid: boolean, errors: string[], warnings: string[] }
```

---

## Fase 5: PO Maestra e IDs Híbridos

### 5.1 Ciclo Perpetuo de PO

```text
FLUJO DE PO MAESTRA
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  PO Abierta │────▶│ PO Cerrada  │────▶│ Nueva PO    │
│  (open)     │     │ (closed)    │     │ Automática  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────────────────────────┐
│  Pedidos vinculados pasan a estado "preparing"     │
│  Se genera tracking híbrido para cada pedido       │
└─────────────────────────────────────────────────────┘
```

### 5.2 Formato de ID Interno Maestro

```text
FORMATO: [PAÍS]-[DEPTO]-[PO]-[TRACKING]-[HUB]-[XXXX][-SUFIJO]

EJEMPLOS:
  HT-OU-PO2401-CHN12345-MIA-0001          (Standard)
  HT-AR-PO2401-CHN12345-MIA-0002-EXP      (Express)
  HT-CE-PO2401-CHN12345-MIA-0003-OVZ      (Oversize)
  HT-NI-PO2401-CHN12345-MIA-0004-SEN      (Sensible)
  HT-OU-PO2401-CHN12345-MIA-0005-EXP-SEN  (Express + Sensible)

COMPONENTES:
  - PAÍS: Código ISO de 2 letras (HT = Haití)
  - DEPTO: Código de departamento (OU = Ouest)
  - PO: Número de PO Maestra (AAMM)
  - TRACKING: Tracking de China
  - HUB: Hub de tránsito (MIA = Miami)
  - XXXX: Secuencial dentro de PO
  - SUFIJOS: -EXP, -OVZ, -SEN (combinables)
```

### 5.3 Instrucciones de Packing Automáticas

```text
TIPO DE PRODUCTO → INSTRUCCIÓN PACKING
├── Standard     → "Caja Estándar"
├── Oversize     → "Embalaje Especial - Dimensiones XL"
├── Sensible     → "Manejo Especial - Producto Frágil/Líquido/Batería"
└── Express      → "⚡ PRIORIDAD - Separar para envío rápido"
```

### 5.4 Función RPC: close_po_and_open_new

```text
PROCESO:
  1. Cerrar PO actual (status = 'closed', closed_at = NOW())
  2. Actualizar pedidos vinculados (status = 'preparing')
  3. Generar IDs híbridos para cada pedido
  4. Crear nueva PO (status = 'open')
  5. Retornar resumen de transición

SALIDA:
  {
    closed_po_id, closed_po_number,
    orders_transitioned: number,
    new_po_id, new_po_number
  }
```

---

## Fase 6: Archivos a Crear/Modificar

### Nuevos Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/hooks/useB2BPricingEngineV2.ts` | Motor de precios con multitramo |
| `src/hooks/useB2BShippingOptions.ts` | Opciones de envío por dirección |
| `src/hooks/useB2BCheckoutV2.ts` | Checkout orquestador actualizado |
| `src/hooks/usePOCycleManagement.ts` | Gestión ciclo PO perpetuo |
| `src/components/checkout/B2BShippingSelector.tsx` | UI selector Standard/Express |
| `src/components/checkout/B2BOrderSummary.tsx` | Resumen con desglose |
| `src/components/checkout/B2BWeightBreakdown.tsx` | Peso real vs facturable |
| `src/components/checkout/B2BCoverageAlert.tsx` | Alerta sin cobertura |
| `src/components/admin/POPackingInstructions.tsx` | Instrucciones de packing |
| `src/types/b2b-shipping.ts` | Tipos para shipping multitramo |

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/hooks/useSellerCatalog.ts` | Agregar `storeId` al return |
| `src/hooks/useB2BServices.ts` | Corregir import, agregar validación UUID |
| `src/pages/ProductPage.tsx` | Declarar `dynamicPrice`, integrar motor |
| `src/pages/seller/SellerCatalogo.tsx` | Usar stats extendidos |
| `src/pages/seller/SellerCheckout.tsx` | Integrar nuevo checkout V2 |
| `src/pages/seller/SellerInventarioB2C.tsx` | Adaptar a nuevo hook |

### Migración SQL

```sql
-- Nueva migración: 20260201_b2b_multitramo_engine.sql
-- Contenido:
--   1. Tabla shipping_zones
--   2. Tabla shipping_tiers  
--   3. Tabla product_shipping_classes
--   4. Extensión products (weight_g, dimensiones)
--   5. Función calculate_b2b_price_multitramo
--   6. Función get_shipping_options_by_address
--   7. Función validate_product_for_shipping
--   8. Función close_po_and_open_new
--   9. Función generate_hybrid_tracking_id
--   10. Vista v_shipping_options_by_country
--   11. Triggers para ciclo PO perpetuo
```

---

## Secuencia de Implementación

```text
ORDEN DE EJECUCIÓN
──────────────────────────────────────────────────────────────────
│ DÍA 1: Corrección de Errores + Migración SQL
│   ├── Corregir 10 errores de TypeScript
│   └── Ejecutar migración con nuevas tablas/funciones
│
│ DÍA 2: Motor de Precios V2
│   ├── Crear useB2BPricingEngineV2.ts
│   ├── Crear types/b2b-shipping.ts
│   └── Integrar en ProductPage.tsx
│
│ DÍA 3: Sistema de Zonificación
│   ├── Crear useB2BShippingOptions.ts
│   ├── Seed data para zonas de Haití
│   └── Crear B2BCoverageAlert.tsx
│
│ DÍA 4: Checkout Dinámico
│   ├── Crear componentes B2BShippingSelector, B2BOrderSummary
│   ├── Crear B2BWeightBreakdown.tsx
│   └── Actualizar SellerCheckout.tsx
│
│ DÍA 5: PO Maestra + IDs Híbridos
│   ├── Crear usePOCycleManagement.ts
│   ├── Implementar generador de IDs híbridos
│   └── Crear POPackingInstructions.tsx
│
│ DÍA 6: Testing + Refinamiento
│   ├── Tests unitarios para conversión de unidades
│   ├── Tests de integración para checkout
│   └── Validación de flujo completo
──────────────────────────────────────────────────────────────────
```

---

## Sección Técnica Detallada

### Constantes de Conversión

```typescript
// Conversión de unidades
const GRAMS_TO_KG = 1000;
const GRAMS_TO_LB = 453.59237;
const CBM_FACTOR = 5000; // Factor volumétrico estándar

// Peso mínimo facturable
const MIN_BILLABLE_WEIGHT = 1;

// Redondeo B2B agrupado
const roundUp = (weight: number) => Math.max(MIN_BILLABLE_WEIGHT, Math.ceil(weight));
```

### Fórmulas de Cálculo

```typescript
// Peso volumétrico (productos oversize)
const volumetricWeight = (L * W * H) / CBM_FACTOR;
const billableWeight = Math.max(realWeight, volumetricWeight);

// Costo por tramo
const tramoACost = Math.max(minCostA, weightKg * ratePerKg);
const tramoBCost = Math.max(minCostB, weightLb * ratePerLb);

// Recargo de zona
const zoneSurcharge = (tramoACost + tramoBCost) * zone.surchargePercent;

// Recargo sensible
const sensitiveSurcharge = weightGrams * sensitiveRatePerGram;

// Platform fee
const platformFee = subtotal * 0.12;

// Precio aterrizado final
const landedPrice = factoryCost + tramoACost + tramoBCost 
                  + zoneSurcharge + oversizeSurcharge 
                  + sensitiveSurcharge + platformFee;
```

### Validaciones de Negocio

```typescript
// Validación Express
if (tierType === 'express' && product.isOversize) {
  return { valid: false, error: 'Productos oversize no permiten envío Express' };
}

// Validación de cobertura
if (!zone || !zone.coverageActive) {
  return { valid: false, error: 'Sin cobertura logística en esta zona' };
}

// Validación de peso
if (product.weightG <= 0) {
  return { valid: false, error: 'Producto sin peso configurado' };
}
```

---

## Resultado Esperado

Al completar esta implementación:

1. **Motor de Precios**: Cálculo preciso con conversión g→kg (Tramo A) y g→lb (Tramo B)
2. **Shipping Tiers**: Opciones Standard y Express con tarifas/ETAs independientes
3. **Zonificación**: Recargos automáticos por ubicación (Capital 0% → Remota 25%)
4. **Checkout Reactivo**: Recálculo instantáneo al cambiar dirección
5. **Desglose Transparente**: Peso real vs facturable, costos por tramo
6. **Clasificación de Productos**: Standard, Oversize, Sensible con restricciones
7. **PO Perpetua**: Ciclo automático open→closed→new con IDs híbridos
8. **Packing Instructions**: Instrucciones automáticas para el agente de compra
