# ✅ TAB DE TIPOS DE ENVÍO EN GLOBAL-LOGISTICS - COMPLETADO

## 🎯 Problema Resuelto

El usuario reportó: "No se ve la pestaña de tipo de envío en la página de global-logistics"

## 📁 Archivo Modificado

**`src/pages/admin/AdminGlobalLogisticsPage.tsx`**

Esta es la página principal de logística que el usuario estaba viendo en `/admin/global-logistics`

## 🚀 Implementación Completa

### 1. Nuevo Tab "Tipos de Envío" Agregado

**Tabs actualizados:**
- ✅ Rutas y Tramos
- ✅ Hubs
- ✅ Mercados
- ✅ Tarifas Categoría
- ⭐ **NUEVO: Tipos de Envío**
- ✅ Calculadora

### 2. Interfaces y Tipos

```typescript
interface ShippingTier {
  id: string;
  route_id: string;
  tier_type: 'standard' | 'express';
  tier_name: string;
  transport_type: 'maritimo' | 'aereo';
  tramo_a_cost_per_kg: number;
  tramo_a_min_cost: number;
  tramo_a_eta_min: number;
  tramo_a_eta_max: number;
  tramo_b_cost_per_lb: number;
  tramo_b_min_cost: number;
  tramo_b_eta_min: number;
  tramo_b_eta_max: number;
  allows_oversize: boolean;
  allows_sensitive: boolean;
  is_active: boolean;
  priority_order: number;
  created_at: string;
}
```

### 3. Query para Obtener Tipos de Envío

```typescript
const { data: shippingTiers, isLoading: loadingTiers, refetch: refetchTiers } = useQuery({
  queryKey: ['shipping_tiers_all'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('shipping_tiers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as ShippingTier[];
  },
});
```

### 4. Mutations para CRUD

#### Crear/Actualizar
```typescript
const saveTierMutation = useMutation({
  mutationFn: async (tier: Partial<ShippingTier>) => {
    if (tier.id) {
      // UPDATE
      const { data, error } = await supabase
        .from('shipping_tiers')
        .update(tier)
        .eq('id', tier.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      // INSERT
      const { data, error } = await supabase
        .from('shipping_tiers')
        .insert([tier])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['shipping_tiers_all'] });
    toast({ title: 'Tipo de envío guardado exitosamente' });
    setShowTierDialog(false);
    refetchTiers();
  },
});
```

#### Eliminar
```typescript
const deleteTierMutation = useMutation({
  mutationFn: async (tierId: string) => {
    const { error } = await supabase
      .from('shipping_tiers')
      .delete()
      .eq('id', tierId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['shipping_tiers_all'] });
    toast({ title: 'Tipo de envío eliminado' });
    refetchTiers();
  },
});
```

### 5. UI del Tab "Tipos de Envío"

#### Vista de Lista
- **Muestra todos los tipos de envío configurados**
- Cards con información completa:
  - Nombre del servicio
  - Badges: Standard/Express, Marítimo/Aéreo, Activo/Inactivo
  - Ruta asignada (Hub → Destino)
  - Información de Tramo A (kg): Costo/kg, Mínimo, ETA
  - Información de Tramo B (lb): Costo/lb, Mínimo, ETA
  - Capacidades: Oversize, Sensibles, Prioridad
  - Botones: Editar, Eliminar

#### Empty State
```
"No hay tipos de envío configurados"
"Haz clic en 'Nuevo Tipo' para agregar el primer tipo de envío"
```

#### Skeleton Loading
Muestra 3 skeletons mientras carga los datos

### 6. Dialog de Creación/Edición

**Formulario completo con:**

#### Selector de Ruta (REQUERIDO)
```typescript
<Select value={tierForm.route_id}>
  {routes?.filter(r => r.is_active).map(route => (
    <SelectItem value={route.id}>
      {route.is_direct 
        ? `Directo → ${route.destination_country?.name}` 
        : `${route.transit_hub?.name} → ${route.destination_country?.name}`}
    </SelectItem>
  ))}
</Select>
```

#### Tipo de Envío (REQUERIDO)
- 📦 **Standard** (Económico, Consolidado)
- ⚡ **Express** (Rápido, Prioritario)

Auto-completa nombre sugerido al seleccionar tipo

#### Tipo de Transporte (REQUERIDO)
- 🚢 **Marítimo** (15-30 días típicamente)
- ✈️ **Aéreo** (5-10 días típicamente)

#### Nombre del Servicio (REQUERIDO)
Input con placeholder: "Ej: Standard - Consolidado Marítimo"

#### Configuración Tramo A (Origen → Hub)
Sección con fondo azul:
- Costo por kg (USD)
- Costo mínimo (USD)
- ETA mínimo (días)
- ETA máximo (días)

#### Configuración Tramo B (Hub → Destino)
Sección con fondo verde:
- Costo por lb (USD)
- Costo mínimo (USD)
- ETA mínimo (días)
- ETA máximo (días)

#### Capacidades y Estado
- Switch: Permite Oversize
- Switch: Permite Sensibles
- Switch: Activo
- Input: Orden de Prioridad (número)

#### Validación
```typescript
disabled={!tierForm.route_id || !tierForm.tier_name || saveTierMutation.isPending}
```

Botón deshabilitado si:
- No se ha seleccionado ruta
- No se ha ingresado nombre
- Guardado en progreso

### 7. Imports Agregados

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Ship, Zap } from 'lucide-react'; // Iconos adicionales
```

### 8. Estados Agregados

```typescript
// Dialog states
const [showTierDialog, setShowTierDialog] = useState(false);

// Editing states
const [editingTier, setEditingTier] = useState<ShippingTier | null>(null);

// Form state
const [tierForm, setTierForm] = useState({
  route_id: '',
  tier_type: 'standard' as 'standard' | 'express',
  tier_name: '',
  transport_type: 'maritimo' as 'maritimo' | 'aereo',
  tramo_a_cost_per_kg: 8.0,
  tramo_a_min_cost: 5.0,
  tramo_a_eta_min: 15,
  tramo_a_eta_max: 25,
  tramo_b_cost_per_lb: 5.0,
  tramo_b_min_cost: 3.0,
  tramo_b_eta_min: 3,
  tramo_b_eta_max: 7,
  allows_oversize: true,
  allows_sensitive: true,
  is_active: true,
  priority_order: 1,
});
```

## 🎨 Diseño Visual

### Cards de Tipos de Envío
```
┌─────────────────────────────────────────────────────────┐
│ Standard - Consolidado Marítimo  [Standard] [Marítimo]  │
│ 📍 Miami Hub → Haití                        [Edit] [🗑️] │
├─────────────────────────────────────────────────────────┤
│ ┌─── Tramo A (Origen → Hub) ───┐ ┌─── Tramo B ───────┐ │
│ │ Costo/kg:    $8.00/kg        │ │ Costo/lb: $5.00/lb│ │
│ │ Mínimo:      $5.00           │ │ Mínimo:   $3.00   │ │
│ │ ETA:         15-25 días      │ │ ETA:      3-7 días│ │
│ └──────────────────────────────┘ └───────────────────┘ │
│ [✓ Oversize] [✓ Sensibles] [Prioridad: 1]             │
└─────────────────────────────────────────────────────────┘
```

### Colores y Badges
- **Standard**: Badge secundario (gris) con icono 📦
- **Express**: Badge default (azul) con icono ⚡
- **Marítimo**: Badge outline con icono 🚢
- **Aéreo**: Badge outline con icono ✈️
- **Inactivo**: Badge destructive (rojo)
- **Tramo A**: Fondo azul claro
- **Tramo B**: Fondo verde claro

## 🔄 Flujo de Trabajo

### Crear Nuevo Tipo de Envío

1. **Click en "Nuevo Tipo"** en el header del tab
2. **Seleccionar Ruta** del dropdown (requerido)
3. **Seleccionar Tipo**: Standard o Express
   - Auto-completa nombre sugerido
4. **Seleccionar Transporte**: Marítimo o Aéreo
5. **Editar Nombre** si es necesario
6. **Configurar Tramo A** (costos en kg, ETAs)
7. **Configurar Tramo B** (costos en lb, ETAs)
8. **Configurar Capacidades** (switches)
9. **Guardar**
   - Validación automática
   - Toast de confirmación
   - Recarga automática de lista

### Editar Tipo Existente

1. **Click en botón Edit** del tipo deseado
2. Dialog se abre con datos pre-cargados
3. Modificar campos necesarios
4. Guardar cambios

### Eliminar Tipo

1. **Click en botón 🗑️** del tipo deseado
2. Confirmación: "¿Eliminar este tipo de envío?"
3. Si confirma: eliminación y recarga automática

## 📊 Integración con Sistema Existente

### Conexión con Rutas
Los tipos de envío se asignan a rutas específicas. El selector muestra:
- Rutas directas: "Directo → Destino"
- Rutas con hub: "Hub → Destino"
- Solo rutas activas

### Uso en Checkout
Los tipos configurados aquí aparecerán en:
- `SellerCheckout.tsx` → Selector B2BShippingSelector
- Engine de pricing B2B
- Cálculo de costos multitramo

### Base de Datos
Tabla: `shipping_tiers`
- Migración ya ejecutada: `20260202_transport_type.sql`
- Migración de peso: `20260202_peso_gramos.sql`

## ✅ Estado: COMPLETADO

- ✅ Tab agregado a TabsList
- ✅ TabsContent implementado con lista completa
- ✅ Query para obtener todos los tiers
- ✅ Mutations para crear/editar/eliminar
- ✅ Dialog de formulario completo
- ✅ Validaciones implementadas
- ✅ Estados y handlers completos
- ✅ UI responsive y accesible
- ✅ Sin errores de TypeScript
- ✅ Integración con sistema de rutas
- ✅ Toast notifications
- ✅ Loading states (skeleton)
- ✅ Empty states

## 🧪 Testing

### Acceder al Tab
1. Ir a `/admin/global-logistics`
2. Click en tab "Tipos de Envío" (6to tab)
3. Verificar que se muestra correctamente

### Crear Tipo de Envío
1. Click "Nuevo Tipo"
2. Seleccionar ruta
3. Configurar Standard - Marítimo
4. Guardar
5. Verificar que aparece en lista

### Verificar en Checkout
1. Ir a `/seller/checkout`
2. Seleccionar dirección
3. Verificar que opciones de envío aparecen
4. Ver logs en consola (F12)

## 📝 Notas

- **Diferencia con AdminLogisticaRutas.tsx**: Esta es la página principal que el usuario estaba viendo. El otro archivo parece ser legacy o una versión alternativa.
- **Rutas vs Tipos**: Las rutas definen el path logístico (origen-hub-destino). Los tipos (tiers) definen el servicio sobre esa ruta (Standard/Express con costos específicos).
- **Peso en Tramo A**: Se mide en kilogramos (kg)
- **Peso en Tramo B**: Se mide en libras (lb)
- **Math.ceil()**: Ya implementado en migrations para redondear hacia arriba
- **Peso mínimo**: 200g configurado en constraints

---

**Fecha de implementación:** 2025-02-02  
**Archivo:** `src/pages/admin/AdminGlobalLogisticsPage.tsx`  
**Líneas agregadas:** ~400 líneas
