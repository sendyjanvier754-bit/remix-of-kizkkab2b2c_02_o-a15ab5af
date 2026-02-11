# Vinculación de Tipos de Envío a Rutas y Tramos
## Fecha: Febrero 10, 2026

---

## RESUMEN EJECUTIVO

### Problema Actual
- Los "Tipos de Envío" (Standard/Express) en la UI no tienen una vinculación explícita con las "Rutas y Tramos"
- Se puede crear un tipo de envío sin asignar costos a una ruta específica
- No hay forma de agregar cargos extra específicos por tipo de envío

### Solución Propuesta
1. **Nueva tabla: `shipping_type_configs`**
   - Vincula cada Tipo de Envío a una Ruta + Tier específico
   - Los tipos de envío **USAN las tarifas del Tier asignado** (no pueden cambiarlas)
   - Permite cargos extra fijos y/o porcentuales como ADICIÓN a las tarifas base
   - Garantiza que no exista un tipo de envío sin ruta asignada

2. **Función `calculate_shipping_cost_with_type()`**
   - Calcula costo total: (tarifas_tier_base) + (cargos_extra_tipo)
   - Usa el tier específico de la ruta
   - Aplica cargas extra del tipo de envío

3. **Validación en UI**
   - Crear Tipo de Envío requiere: Ruta → Tier (esto define tarifas) → Tipo (solo nombre/extras)
   - Los tipos de envío NO pueden tener sus propias tarifas
   - Campos deshabilitados hasta completar selecciones previas

---

## CÁLCULO DE EJEMPLO: 2 Productos × 0.300 kg

### Datos
```
Ruta: China → China Hub → Haiti
Peso Total: 0.600 kg (2 × 0.300 kg)

Tramo A (Origen → Hub):
  - Costo: $3.50/kg
  - ETA: 7-14 días

Tramo B (Hub → Destino):
  - Costo: $5.00/lb
  - ETA: 3-7 días
```

### Cálculo Base (SIN cargas extra)
```
Fórmula: (weight_kg × tramo_a_cost_per_kg) + (weight_kg × 2.20462 × tramo_b_cost_per_lb)

Tramo A: 0.600 kg × $3.50/kg = $2.10
Tramo B: 0.600 kg × 2.20462 lb/kg × $5.00/lb = $6.61
─────────────────────────────────────
TOTAL BASE: $8.71
```

### Con Cargas Extra (Ejemplo: Express +10%)
```
Costo Base:        $8.71
Cargo Extra (10%): $0.87 (0.871)
─────────────────────────────────────
TOTAL EXPRESS:     $9.58
```

### Con Cargas Extra (Ejemplo: Standard +$0.50 fijo)
```
Costo Base:        $8.71
Cargo Extra Fijo:  $0.50
─────────────────────────────────────
TOTAL STANDARD:    $9.21
```

---

## ESTRUCTURA DE DATOS

### Tabla: `shipping_type_configs` (NUEVA)

**IMPORTANTE: Los Tipos de Envío USAN las tarifas del Tier asignado**

```sql
- id (UUID, PK)
- route_id (UUID, FK → shipping_routes) 
  └─ ¿A qué ruta pertenece este tipo?
  
- type (VARCHAR)
  └─ 'STANDARD' | 'EXPRESS' | 'PRIORITY' | etc.
  
- shipping_tier_id (UUID, FK → shipping_tiers)
  └─ Qué tier (costos BASE) usar para este tipo
  └─ Este tier DEFINE las tarifas tramo_a y tramo_b
  └─ Los tipos de envío NO pueden cambiar estas tarifas
  └─ VALIDACIÓN: Tier debe pertenecer a misma ruta
  
- extra_cost_fixed (NUMERIC)
  └─ Cargo ADICIONAL fijo (ej: +$2.00 por Express)
  └─ Se suma a (tarifas_tier_base)
  
- extra_cost_percent (NUMERIC)
  └─ Cargo ADICIONAL porcentual (ej: +10% por Prioridad)
  └─ Se suma a (tarifas_tier_base)
  
- display_name (VARCHAR)
  └─ "Envío Estándar" | "Envío Express" | etc.
  
- allows_oversize (BOOLEAN)
- allows_sensitive (BOOLEAN)
- min_weight_kg, max_weight_kg
  └─ Restricciones de peso por tipo
  
- is_active (BOOLEAN)
- priority_order (INTEGER)

UNIQUE(route_id, type) 
  └─ Una ruta no puede tener dos tipos "STANDARD"
```

### Ejemplo de Configuración
```
Ruta: China → Hub → Haiti

Tipo: Standard
├─ Tier: Estándar (tramo_a=$3.50/kg, tramo_b=$5.00/lb)
├─ Extra fijo: $0.00
├─ Extra %: 0%
└─ Total 0.6kg: ($2.10 + $6.61) + $0.00 = $8.71

Tipo: Express (MISMO TIER que Standard)
├─ Tier: Estándar (tramo_a=$3.50/kg, tramo_b=$5.00/lb) ← IDÉNTICAS TARIFAS
├─ Extra fijo: $2.00
├─ Extra %: 0%
└─ Total 0.6kg: ($2.10 + $6.61) + $2.00 = $10.71

Tipo: Prioridad (MISMO TIER que Standard)
├─ Tier: Estándar (tramo_a=$3.50/kg, tramo_b=$5.00/lb) ← IDÉNTICAS TARIFAS
├─ Extra fijo: $0.00
├─ Extra %: 15%
└─ Total 0.6kg: ($2.10 + $6.61) + (8.71 × 15%) = $10.01
```

---

## FLUJO DE UI (Administrador)

### Crear/Editar Tipo de Envío

**Paso 1: Seleccionar RUTA (Obligatorio)**
```
┌─ Rutas Disponibles ─────────────────┐
│ [China → China Hub → Haiti]         │  ← Expandir
│ [USA → Port → Dominican Rep]        │
│ [China → Vietnam Hub → Jamaica]     │
└─────────────────────────────────────┘
```

**Paso 2: Seleccionar TIER en esa RUTA (Obligatorio - Define Tarifas)**
```
Ruta: China → China Hub → Haiti
┌─ Tiers Disponibles ─────────────────┐
│ Standard (Lee-only)                 │
│   Tarifas (NO se pueden cambiar):   │
│   ├─ Tramo A: $3.50/kg              │
│   ├─ Tramo B: $5.00/lb              │
│   ├─ ETA: 7-14 días (A) / 3-7 (B)   │
│   └─ [Seleccionar]                  │
│                                     │
│ Express (Aéreo) (Lee-only)          │
│   Tarifas (NO se pueden cambiar):   │
│   ├─ Tramo A: $5.50/kg              │
│   ├─ Tramo B: $2.80/lb              │
│   ├─ ETA: 3-7 días (A) / 2-4 (B)    │
│   └─ [Seleccionar]                  │
└─────────────────────────────────────┘
```

**Paso 3: Configurar TIPO y CARGAS EXTRAS**
```
Tier Seleccionado: Standard
┌─ Tarifas Base (del Tier - No modificables) ─┐
│ Tramo A: $3.50/kg                           │
│ Tramo B: $5.00/lb                           │
└─────────────────────────────────────────────┘

Tipo de Envío:
[STANDARD  ▼]  (no permitir duplicar en esta ruta)

CARGOS EXTRAS (Opcional - se SUMAN a tarifas base):
┌─ Cargo Fijo: $[0.00]  (ej: $2.00 para Express)
└─ Cargo %   : [0]%    (ej: 10% para Prioridad)

Descripción:
┌─────────────────────────────────────────┐
│ Envío estándar con 3-14 días de entrega  │
└─────────────────────────────────────────┘

Restricciones:
☐ Permite Oversize
☑ Permite Sensibles
  Peso Mín: [0.000] kg
  Peso Máx: [100.00] kg
```

**Paso 4: Guardar**
```
[Cancelar] [Guardar]

✓ Validación al guardar:
  - Tier debe pertenecer a la Ruta seleccionada
  - No duplicar Type en la misma Route
  - Cargas extras ≥ 0
```

---

## FLUJO DE UX (Cliente - Orden B2B)

### Seleccionar Tipo de Envío en Carrito

**Desglose Completo (Mostrando Tarifas Base + Cargas Extra)**
```
Ruta: China → China Hub → Haiti
Peso Total: 0.600 kg

Tarifas Base (del Tier - Idénticas para todos los tipos):
├─ Tramo A: $3.50/kg  → 0.600 × $3.50 = $2.10
├─ Tramo B: $5.00/lb  → 0.600 × 2.20462 × $5.00 = $6.61
└─ SUBTOTAL: $8.71

┌─ Envío Estándar ──────────────────────────┐
│ Costo Base (Tiers):     $8.71              │
│ Cargo Extra (Tipo):     $0.00 (0%)         │
│ ────────────────────────────────────────  │
│ TOTAL:                  $8.71    [Elegir] │
│ ETA: 7-14 días         (A) 3-7 días (B)   │
└───────────────────────────────────────────┘

┌─ Envío Express ───────────────────────────┐
│ Costo Base (Tiers):     $8.71 (MISMO)     │
│ Cargo Extra (Tipo):     +$2.00 fijo       │
│ ────────────────────────────────────────  │
│ TOTAL:                  $10.71   [Elegir] │
│ ETA: 3-7 días          (A) 2-4 días (B)   │
└───────────────────────────────────────────┘

┌─ Envío Prioridad ─────────────────────────┐
│ Costo Base (Tiers):     $8.71 (MISMO)     │
│ Cargo Extra (Tipo):     +$1.31 (15%)      │
│ ────────────────────────────────────────  │
│ TOTAL:                  $10.02   [Elegir] │
│ ETA: 1-3 días          (A) 1 día   (B)    │
└───────────────────────────────────────────┘
```

**Nota Importante para el Usuario:**
```
✓ Todas las opciones usan las MISMAS tarifas base
✓ La diferencia es el CARGO EXTRA por cada tipo
✓ Esto garantiza transparencia y consistencia
```

---

## IMPLEMENTACIÓN EN CÓDIGO

### 1. Base de Datos (HECHO) ✓
- Migración: `20260210_shipping_types_linked_to_routes.sql`
- Nueva tabla: `shipping_type_configs`
- Función: `calculate_shipping_cost_with_type()`

### 2. API / Hooks (TODO)

**Hook: `useShippingTypeConfigs()`**
```typescript
interface ShippingTypeConfig {
  id: UUID;
  route_id: UUID;
  type: 'STANDARD' | 'EXPRESS' | 'PRIORITY';
  shipping_tier_id: UUID;
  display_name: string;
  extra_cost_fixed: number;
  extra_cost_percent: number;
  allows_oversize: boolean;
  allows_sensitive: boolean;
  min_weight_kg: number;
  max_weight_kg: number;
}

// Funciones necesarias:
- getTypesForRoute(route_id) → ShippingTypeConfig[]
- calculateCostWithType(weight_kg, type_config_id) → { 
    total_cost, base_cost, extra_cost 
  }
- createTypeConfig(config) → ShippingTypeConfig
- updateTypeConfig(id, updates) → ShippingTypeConfig
- deleteTypeConfig(id) → boolean
```

### 3. Admin UI (TODO)
- Página: `/admin/shipping-types`
- Modal: Crear/Editar Tipo de Envío
- Tabla: Listar tipos de envío por ruta
- Validación: Requerir ruta + tier antes de guardar

### 4. Orden B2B (TODO)
- Componente: `ShippingTypeSelector`
- Usar `calculate_shipping_cost_with_type()` para desglose
- Mostrar costo base + cargas extra
- Validar restricciones de peso/tipo de producto

---

## REGLAS DE VALIDACIÓN

✓ **Crear Tipo de Envío:**
- Ruta obligatoria
- Tier válido para esa ruta (NO cambiar tarifas del tier)
- Tipo (STANDARD/EXPRESS) único por ruta
- El tipo de envío USARÁ exactamente las tarifas del Tier asignado
- Cargas extras (fijo + %) ≥ 0

✓ **Usar Tipo de Envío (en orden):**
- Peso debe estar en rango [min_weight_kg, max_weight_kg]
- Si oversize = false, no permitir productos oversize
- Si allows_sensitive = false, no permitir sensibles
- Calcular: (tarifas_tier_base) + extra_fixed + (tarifas_tier_base × extra_percent/100)
- Las tarifas SIEMPRE vienen del Tier, NO se pueden cambiar por el tipo

✓ **Actualizar Tipo de Envío:**
- No cambiar route_id (eliminar y crear nuevo)
- NO cambiar tier_id (afectaría todas las órdenes)
- Validar que tier siga perteneciendo a la ruta
- Puedo cambiar: cargas extras, restricciones de peso, is_active
- Si hay órdenes activas, mostrar advertencia

✓ **IMPORTANTE - Lo que NO se puede hacer:**
- ✗ Crear tipo de envío sin Select Ruta + Tier
- ✗ Usar diferentes tiers para tipos con mismo nombre en misma ruta
- ✗ Modificar las tarifas del tier desde el tipo (solo agregar extras)
- ✗ Crear tipo de envío huérfano sin ruta/tier

✓ **Eliminar Tipo de Envío:**
- No permitir si hay órdenes activas usando ese tipo
- Requerir confirmación en UI

---

## ESTADO DE IMPLEMENTACIÓN

| Componente | Estado | Notas |
|-----------|--------|-------|
| Tabla `shipping_type_configs` | ✓ HECHO | Migración ejecutada |
| Función `calculate_shipping_cost_with_type()` | ✓ HECHO | PL/pgSQL implementada |
| Hook `useShippingTypeConfigs` | ⏳ TODO | Crear en `src/hooks/` |
| Admin UI - Admin Logística | ⏳ TODO | Página `/admin/shipping-types` |
| Modal Crear/Editar | ⏳ TODO | Validación required fields |
| B2B OrderFlow - Selector | ⏳ TODO | Componente con desglose |
| Tests | ⏳ TODO | Unit + Integration tests |

---

## PRÓXIMOS PASOS

1. ✓ Ejecutar migraciones en Supabase
2. ⏳ Crear hook `useShippingTypeConfigs`
3. ⏳ Crear página Admin: `/admin/shipping-types`
4. ⏳ Actualizar `ShippingTypeSelector` en B2B
5. ⏳ Mostrar desglose de costos en checkout
6. ⏳ Tests E2E

---

## TIEMPO ESTIMADO

- Implementación de hooks: 30 minutos
- UI Admin (CRUD): 1 hora
- B2B Integration: 45 minutos
- Testing: 1 hora
- **Total: 3.25 horas**
