# Agregar Campos de Nombre a Rutas - Interfaz UI

## Problema
El usuario reportó que la opción para modificar el nombre de la ruta no aparecía en el modal de edición de rutas en AdminGlobalLogisticsPage.

## Causa Raíz
Aunque los campos `route_name`, `origin_country`, y `destination_country` se agregaron a la tabla `shipping_routes` en la base de datos mediante el script SQL `ADD_ROUTE_NAMES_AND_ONE_TIER_PER_ROUTE.sql`, estos campos no se habían actualizado en:
1. La interfaz TypeScript `ShippingRoute`
2. El estado del formulario `routeForm` en AdminGlobalLogisticsPage
3. El diálogo de edición de rutas en la UI

## Cambios Realizados

### 1. Actualización de la Interfaz ShippingRoute
**Archivo:** `src/hooks/useCountriesRoutes.ts`

```typescript
export interface ShippingRoute {
  id: string;
  destination_country_id: string;
  transit_hub_id: string | null;
  is_direct: boolean;
  is_active: boolean;
  route_name: string | null;           // ✅ NUEVO
  origin_country: string | null;        // ✅ NUEVO
  destination_country: string | null;   // ✅ NUEVO
  created_at: string;
  updated_at: string;
  destination_country?: DestinationCountry;
  transit_hub?: TransitHub;
}
```

### 2. Actualización del Estado routeForm
**Archivo:** `src/pages/admin/AdminGlobalLogisticsPage.tsx`

```typescript
const [routeForm, setRouteForm] = useState({ 
  destination_country_id: '', 
  transit_hub_id: '', 
  is_direct: false, 
  is_active: true,
  route_name: '',              // ✅ NUEVO
  origin_country: 'China',     // ✅ NUEVO (valor por defecto)
  destination_country: ''      // ✅ NUEVO
});
```

### 3. Actualización de la Lógica de Edición de Ruta
**Archivo:** `src/pages/admin/AdminGlobalLogisticsPage.tsx`

```typescript
const openRouteDialog = (route?: ShippingRoute) => {
  if (route) {
    setEditingRoute(route);
    setRouteForm({
      destination_country_id: route.destination_country_id,
      transit_hub_id: route.transit_hub_id || '',
      is_direct: route.is_direct,
      is_active: route.is_active,
      route_name: route.route_name || '',                    // ✅ NUEVO
      origin_country: route.origin_country || 'China',       // ✅ NUEVO
      destination_country: route.destination_country || '',  // ✅ NUEVO
    });
  } else {
    setEditingRoute(null);
    setRouteForm({ 
      destination_country_id: '', 
      transit_hub_id: '', 
      is_direct: false, 
      is_active: true,
      route_name: '',              // ✅ NUEVO
      origin_country: 'China',     // ✅ NUEVO
      destination_country: ''      // ✅ NUEVO
    });
  }
  setShowRouteDialog(true);
};
```

### 4. Actualización de handleRouteSubmit
**Archivo:** `src/pages/admin/AdminGlobalLogisticsPage.tsx`

```typescript
const handleRouteSubmit = () => {
  const routeData = {
    destination_country_id: routeForm.destination_country_id,
    transit_hub_id: routeForm.is_direct ? null : routeForm.transit_hub_id || null,
    is_direct: routeForm.is_direct,
    is_active: routeForm.is_active,
    route_name: routeForm.route_name || null,              // ✅ NUEVO
    origin_country: routeForm.origin_country || null,      // ✅ NUEVO
    destination_country: routeForm.destination_country || null, // ✅ NUEVO
  };
  // ... resto del código
};
```

### 5. Actualización del Formulario de Diálogo
**Archivo:** `src/pages/admin/AdminGlobalLogisticsPage.tsx`

Se agregaron tres nuevos campos al formulario de edición:

```tsx
<div className="grid gap-4 py-4">
  {/* ✅ NUEVO: Campo de Nombre de Ruta */}
  <div className="grid gap-2">
    <Label>Nombre de la Ruta</Label>
    <Input
      placeholder="Ej: China - Haití Directo"
      value={routeForm.route_name}
      onChange={e => setRouteForm(prev => ({ ...prev, route_name: e.target.value }))}
    />
  </div>
  
  {/* ✅ NUEVO: Campos de País Origen y Destino (texto) */}
  <div className="grid grid-cols-2 gap-4">
    <div className="grid gap-2">
      <Label>País Origen</Label>
      <Input
        placeholder="China"
        value={routeForm.origin_country}
        onChange={e => setRouteForm(prev => ({ ...prev, origin_country: e.target.value }))}
      />
    </div>
    <div className="grid gap-2">
      <Label>País Destino (Texto)</Label>
      <Input
        placeholder="Ej: Haití"
        value={routeForm.destination_country}
        onChange={e => setRouteForm(prev => ({ ...prev, destination_country: e.target.value }))}
      />
    </div>
  </div>
  
  {/* Campo existente: País Destino (ID de BD) */}
  <div className="grid gap-2">
    <Label>País Destino</Label>
    {/* ... Select de destination_country_id ... */}
  </div>
  
  {/* ... resto de campos ... */}
</div>
```

## Resultado

Ahora el modal de "Editar Ruta de Envío" muestra:

1. **Nombre de la Ruta** - Input de texto para dar un nombre personalizado a la ruta
2. **País Origen** - Input de texto (por defecto "China")
3. **País Destino (Texto)** - Input de texto para el nombre del país destino
4. **País Destino** - Select dropdown con los países de la base de datos
5. **Ruta Directa** - Switch para indicar si es directa o tiene hub
6. **Hub de Tránsito** - Select (solo si no es ruta directa)
7. **Activo** - Switch para activar/desactivar la ruta

## Verificación

✅ Interfaz TypeScript actualizada
✅ Estado del formulario actualizado
✅ Lógica de edición actualizada
✅ Lógica de guardado actualizada
✅ Campos visibles en el diálogo de edición
✅ Sin errores de TypeScript

## Notas Importantes

1. **Campos de texto vs. referencias de BD:**
   - `destination_country` (texto) es un campo libre para el nombre del país
   - `destination_country_id` es la referencia a la tabla `destination_countries`
   - Ambos campos existen para flexibilidad

2. **Valores por defecto:**
   - `origin_country` tiene por defecto "China" ya que es el origen principal
   - `route_name` puede dejarse vacío y se guardará como NULL en la BD

3. **Compatibilidad:**
   - Los campos nuevos son opcionales (pueden ser NULL)
   - Las rutas existentes seguirán funcionando sin estos campos
   - La query `.select('*')` en `useCountriesRoutes` incluye automáticamente los nuevos campos

## Próximos Pasos

El usuario ahora podrá:
1. Abrir el diálogo de edición de ruta
2. Ver y editar el nombre de la ruta
3. Ver y editar el país de origen
4. Ver y editar el país de destino (texto)
5. Guardar los cambios que se reflejarán en la base de datos
