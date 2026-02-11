# Actualización de UI Administrativa para Tipos de Envío Vinculados

## Resumen de Cambios Requeridos

Con la nueva tabla `shipping_type_configs`, la estructura administrativa de logística necesita actualizarse para que los administradores puedan:

1. **Crear/Editar Tipos de Envío** vinculados a Rutas específicas
2. **Asignar Tiers a Tipos de Envío** (sin permitir cambiar tarifas)
3. **Agregar Cargos Extras** fijos y/o porcentuales
4. **Ver matriz completa** de Rutas → Tipos de Envío → Costos

---

## COMPONENTES A ACTUALIZAR

### 1. Página: `AdminLogisticaRutas.tsx` (PRINCIPAL)
**Ubicación:** `src/pages/admin/AdminLogisticaRutas.tsx`
**Estado:** Necesita nueva pestaña para Tipos de Envío

#### Cambios Necesarios:
```tsx
// Agregar nueva interfaz
interface ShippingTypeConfig {
  id: string;
  route_id: string;
  shipping_tier_id: string;
  type: 'STANDARD' | 'EXPRESS' | 'PRIORITY'; // etc
  display_name: string;
  description?: string;
  extra_cost_fixed: number;
  extra_cost_percent: number;
  allows_oversize: boolean;
  allows_sensitive: boolean;
  min_weight_kg: number;
  max_weight_kg?: number;
  is_active: boolean;
  priority_order: number;
}

// Agregar nueva pestaña
const [activeTab, setActiveTab] = useState<'routes' | 'tiers' | 'types'>('routes');
//                                                         ^^^^^^^ Nueva

// Agregar query para fetch tipos de envío
const { data: shippingTypes } = useQuery({
  queryKey: ['shipping_type_configs'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('shipping_type_configs')
      .select('*')
      .order('route_id, priority_order');
    if (error) throw error;
    return data as ShippingTypeConfig[];
  }
});
```

#### Nueva Pestaña: "Tipos de Envío"
```
┌─ Filtrar por Ruta: [China → Haiti ▼]
│
│ Crear Tipo de Envío [+]
│
├─ Tabla de Tipos ────────────────────────────────────────┐
│ Tipo      | Ruta        | Tier    | Cargos  | Acciones │
│────────────────────────────────────────────────────────│
│ STANDARD  | China→Haiti | Std     | $0 0%   | [E] [X]  │
│ EXPRESS   | China→Haiti | Std     | $2 0%   | [E] [X]  │
│ PRIORITY  | China→Haiti | Std     | $0 15%  | [E] [X]  │
│ STANDARD  | USA→DomRep  | Aéreo   | $0 0%   | [E] [X]  │
└─ Tabla de Tipos ────────────────────────────────────────┘
```

---

### 2. Modal: "Crear/Editar Tipo de Envío" (NUEVA)
**Ubicación:** Dentro de `AdminLogisticaRutas.tsx`
**Componente recomendado:** Crear `ShippingTypeConfigDialog`

```tsx
// Estructura del Modal
interface ShippingTypeConfigDialogProps {
  route?: ShippingRoute;
  tier?: ShippingTier;
  typeConfig?: ShippingTypeConfig;
  onSave: (config: ShippingTypeConfig) => Promise<void>;
  onClose: () => void;
}

// Lógica:
// 1. Si es edición: deshabilitados route_id y tier_id (no cambiar después crear)
// 2. Si es creación: enable route_id y tier_id
// 3. Vista de read-only para tarifas del tier
// 4. Inputs editable para cargas extras
```

**Campos del Modal:**
```
┌─ Crear Tipo de Envío ──────────────────────────────────┐
│                                                         │
│ SECCIÓN 1: VINCULACIÓN (Solo si es nuevo)              │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Ruta: [Seleccionar... ▼]                            ││
│ │       └─ [China→Haiti] [USA→DomRep] [etc]          ││
│ │                                                      ││
│ │ Tier: [Seleccionar... ▼] (filtra por ruta)         ││
│ │       └─ [Standard] [Express] [Aéreo] [etc]        ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ SECCIÓN 2: TARIFAS BASE (Read-Only - del Tier)        │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Tramo A (Origen → Hub)                              ││
│ │  ✓ $3.50/kg ETA: 7-14 días (no editable)           ││
│ │                                                      ││
│ │ Tramo B (Hub → Destino)                             ││
│ │  ✓ $5.00/lb ETA: 3-7 días (no editable)            ││
│ │                                                      ││
│ │ Transport: Marítimo (no editable)                   ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ SECCIÓN 3: CONFIGURACIÓN DE TIPO (Editable)           │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Tipo de Envío: [STANDARD     ▼]                     ││
│ │  (no permitir duplicar en la misma ruta)            ││
│ │                                                      ││
│ │ Nombre para Mostrar:                                 ││
│ │ [_____________________________]                      ││
│ │  Ejemplo: "Envío Estándar" "Envío Express"         ││
│ │                                                      ││
│ │ Descripción (opcional):                             ││
│ │ [_____________________________________]             ││
│ │  Ejemplo: "Entrega en 7-14 días"                   ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ SECCIÓN 4: CARGOS EXTRAS (Opcional)                   │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Cargo Fijo Adicional: $[_______] (ej: 2.00)        ││
│ │  └─ Se suma a TODOS los pedidos                    ││
│ │                                                      ││
│ │ Cargo % Adicional: [_______]% (ej: 10)             ││
│ │  └─ Porcentaje del costo base                      ││
│ │                                                      ││
│ │ PREVIEW: Ej para 0.6kg:                             ││
│ │  Base: $8.71 + Extras: $0.29 = TOTAL: $9.00        ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ SECCIÓN 5: RESTRICCIONES (Opcional)                   │
│ ┌─────────────────────────────────────────────────────┐│
│ │ ☑ Permite Productos Oversize                        ││
│ │ ☑ Permite Productos Sensibles                       ││
│ │                                                      ││
│ │ Peso Mínimo: [_______] kg                           ││
│ │ Peso Máximo: [_______] kg                           ││
│ │                                                      ││
│ │ ☑ Activo                                             ││
│ │ Prioridad: [1    ▼]                                 ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ [Cancelar]  [Guardar]                                  │
└─ Crear Tipo de Envío ──────────────────────────────────┘
```

---

### 3. Hook: `useShippingTypeConfigs` (NUEVA)
**Ubicación:** `src/hooks/useShippingTypeConfigs.ts`

```typescript
export const useShippingTypeConfigs = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // GET: Obtener tipos de envío
  const getConfigs = useQuery({
    queryKey: ['shipping_type_configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_type_configs')
        .select('*')
        .order('route_id, priority_order');
      if (error) throw error;
      return data;
    }
  });

  // GET: Obtener tipos de envío por ruta
  const getConfigsByRoute = useQuery({
    queryKey: ['shipping_type_configs', routeId],
    queryFn: async (routeId: string) => {
      const { data, error } = await supabase
        .from('shipping_type_configs')
        .select('*')
        .eq('route_id', routeId)
        .order('priority_order');
      if (error) throw error;
      return data;
    },
    enabled: !!routeId
  });

  // CREATE: Crear tipo de envío
  const createConfig = useMutation({
    mutationFn: async (config: ShippingTypeConfig) => {
      // Validar que tier pertenezca a ruta
      const tierValid = await validateTierBelongsToRoute(
        config.shipping_tier_id,
        config.route_id
      );
      if (!tierValid) {
        throw new Error('El Tier no pertenece a la Ruta seleccionada');
      }

      // Validar que no exista tipo duplicado en ruta
      const existing = await checkDuplicateType(config.route_id, config.type);
      if (existing) {
        throw new Error(`Ya existe un tipo ${config.type} en esta ruta`);
      }

      const { data, error } = await supabase
        .from('shipping_type_configs')
        .insert([config])
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping_type_configs'] });
      toast.success('Tipo de envío creado exitosamente');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  // UPDATE: Actualizar tipo de envío
  const updateConfig = useMutation({
    mutationFn: async (config: ShippingTypeConfig) => {
      // Validar que no tenga órdenes activas si cambian detalles críticos
      const hasActiveOrders = await checkActiveOrders(config.id);
      if (hasActiveOrders) {
        throw new Error('No se puede modificar: hay órdenes activas usando este tipo');
      }

      const { data, error } = await supabase
        .from('shipping_type_configs')
        .update(config)
        .eq('id', config.id)
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping_type_configs'] });
      toast.success('Tipo de envío actualizado');
    }
  });

  // DELETE: Eliminar tipo de envío
  const deleteConfig = useMutation({
    mutationFn: async (configId: string) => {
      // Validar que no haya órdenes activas
      const hasActiveOrders = await checkActiveOrders(configId);
      if (hasActiveOrders) {
        throw new Error('No se puede eliminar: hay órdenes activas usando este tipo');
      }

      const { error } = await supabase
        .from('shipping_type_configs')
        .delete()
        .eq('id', configId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping_type_configs'] });
      toast.success('Tipo de envío eliminado');
    }
  });

  return {
    getConfigs,
    getConfigsByRoute,
    createConfig,
    updateConfig,
    deleteConfig
  };
};
```

---

### 4. Vista SQL: `v_shipping_type_details` (NUEVA)
**Para facilitar queries del admin**

```sql
CREATE OR REPLACE VIEW v_shipping_type_details AS
SELECT 
  stc.id,
  stc.route_id,
  sr.origin_country,
  sr.hub_location,
  sr.destination_country,
  stc.type,
  stc.display_name,
  st.tier_type,
  st.tramo_a_cost_per_kg,
  st.tramo_b_cost_per_lb,
  st.tramo_a_eta_min,
  st.tramo_a_eta_max,
  st.tramo_b_eta_min,
  st.tramo_b_eta_max,
  st.allows_oversize as tier_allows_oversize,
  st.allows_sensitive as tier_allows_sensitive,
  stc.extra_cost_fixed,
  stc.extra_cost_percent,
  stc.allows_oversize,
  stc.allows_sensitive,
  stc.min_weight_kg,
  stc.max_weight_kg,
  stc.is_active,
  stc.priority_order,
  stc.created_at,
  stc.updated_at
FROM shipping_type_configs stc
JOIN shipping_routes sr ON stc.route_id = sr.id
JOIN shipping_tiers st ON stc.shipping_tier_id = st.id
ORDER BY sr.origin_country, sr.destination_country, stc.type;
```

---

## FLUJO DE TRABAJO EN UI

### Paso 1: Admin abre "Tipos de Envío"
- Selecciona una Ruta (dropdown)
- Ve tabla de tipos de envío para esa ruta

### Paso 2: Admin hace click en "Crear Tipo"
- Modal se abre
- Muestra LISTA DE RUTAS (field 1)
- Admin selecciona ruta

### Paso 3: Admin selecciona Ruta
- Field 2 "Tier" se habilita
- Filtra y muestra Tiers disponibles para esa ruta

### Paso 4: Admin selecciona Tier
- Sección "Tarifas Base" se llena (Read-Only)
- Admin ve: Tramo A, Tramo B, ETAs, Transport

### Paso 5: Admin configura el Tipo
- Ingresa nombre tipo: "STANDARD", "EXPRESS", etc.
- Ingresa cargos extras fijos y %
- Configura restricciones de peso/producto

### Paso 6: Admin guarda
- Sistema valida:
  - ✓ Tier pertenece a ruta
  - ✓ Tipo no duplicado en ruta
  - ✓ Cargas extras ≥ 0
- Crea record en shipping_type_configs

---

## VALIDACIONES A IMPLEMENTAR

### Backend (PL/pgSQL)
✓ (Ya existe) - CHECK constraint en tabla
✓ (Ya existe) - UNIQUE(route_id, type)

### Frontend (TypeScript)
```typescript
// Validar Tier pertenece a Ruta
async validateTierBelongsToRoute(tierId, routeId) {
  const { data } = await supabase
    .from('shipping_tiers')
    .select('id')
    .eq('id', tierId)
    .eq('route_id', routeId)
    .single();
  return !!data;
}

// Validar tipo no duplicado
async checkDuplicateType(routeId, type) {
  const { data } = await supabase
    .from('shipping_type_configs')
    .select('id')
    .eq('route_id', routeId)
    .eq('type', type)
    .maybeSingle();
  return !!data;
}

// Verificar órdenes activas
async checkActiveOrders(typeConfigId) {
  const { data } = await supabase
    .from('orders_b2b')
    .select('id')
    .eq('shipping_type_config_id', typeConfigId)
    .in('status', ['pending', 'confirmed', 'processing'])
    .maybeSingle();
  return !!data;
}
```

---

## CRONOGRAMA DE IMPLEMENTACIÓN

| Componente | Tiempo | Estado |
|-----------|---------|--------|
| Hook: `useShippingTypeConfigs` | 30 min | ⏳ TODO |
| Modal: `ShippingTypeConfigDialog` | 45 min | ⏳ TODO |
| Pestaña nueva en `AdminLogisticaRutas` | 30 min | ⏳ TODO |
| Vista SQL: `v_shipping_type_details` | 10 min | ⏳ TODO |
| Tests & Validaciones | 45 min | ⏳ TODO |
| **TOTAL** | **2.5 horas** | ⏳ TODO |

---

## EQUIVALENCIAS CON CAMBIOS EN BD

**Base de Datos:**
- ✓ Tabla `shipping_type_configs` creada
- ✓ Función `calculate_shipping_cost_with_type()` creada
- (Pendiente) Vista `v_shipping_type_details`

**Administración UI:**
- ⏳ Hook para CRUD de tipos
- ⏳ Modal para Crear/Editar
- ⏳ Pestaña en AdminLogisticaRutas
- ⏳ Integración con B2B Checkout

**Orden B2B:**
- ⏳ Selector de tipos de envío
- ⏳ Mostrar desglose de costos
- ⏳ Validar restricciones de peso/tipo
