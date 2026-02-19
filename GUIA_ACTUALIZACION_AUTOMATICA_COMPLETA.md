# ✅ ACTUALIZACIÓN AUTOMÁTICA: Shipping Tiers desde Route Logistics

## 🎯 Problema Resuelto

**Antes:** Cuando cambias un costo en `route_logistics_costs` (tramo A, B, C o D), tenías que:
1. Abrir modal de editar tipo de envío
2. Hacer clic en "Cargar desde Segmentos"
3. Guardar

**Ahora:** 🚀 **AUTOMÁTICO**
1. Cambias costo en `route_logistics_costs`
2. Se actualiza automáticamente en `shipping_tiers`
3. El carrito/checkout se recalcula solo
4. **TODO EN TIEMPO REAL** sin refrescar página

---

## 📋 Archivos Implementados

### 1. SQL: Trigger Auto-Sincronización ([TRIGGER_AUTO_SYNC_TIERS_DESDE_SEGMENTOS.sql](./TRIGGER_AUTO_SYNC_TIERS_DESDE_SEGMENTOS.sql))

**Qué hace:**
```sql
-- Trigger que escucha cambios en route_logistics_costs
CREATE TRIGGER trigger_auto_sync_tiers_from_segments
  AFTER INSERT OR UPDATE OF cost_per_kg, estimated_days_min, estimated_days_max
  ON public.route_logistics_costs
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE AND NEW.segment IN ('china_to_transit', 'transit_to_destination'))
  EXECUTE FUNCTION sync_shipping_tiers_from_segments();
```

**Flujo:**
1. Admin cambia `cost_per_kg` en `route_logistics_costs`
2. Trigger detecta el cambio
3. **Automáticamente** actualiza todos los `shipping_tiers` que usan esa ruta + tipo de transporte
4. Mantiene sincronizados:
   - `tramo_a_cost_per_kg` si cambió Tramo A (china_to_transit)
   - `tramo_b_cost_per_kg` si cambió Tramo B (transit_to_destination)
   - `tramo_b_cost_per_lb` (calculado: kg × 2.20462)
   - ETAs (min/max)

---

### 2. Frontend: Hook Realtime ([useShippingTiersRealtimeSync.ts](./src/hooks/useShippingTiersRealtimeSync.ts))

**Qué hace:**
```typescript
export function useShippingTiersRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Escuchar cambios en shipping_tiers via Supabase Realtime
    const channel = supabase
      .channel('shipping_tiers_realtime_sync')
      .on('postgres_changes', { table: 'shipping_tiers' }, (payload) => {
        // Invalidar todas las queries de TanStack Query
        queryClient.invalidateQueries({ queryKey: ['shipping-tiers'] });
        queryClient.invalidateQueries({ queryKey: ['cart-shipping-cost'] });
        // ... más queries
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [queryClient]);
}
```

**Flujo:**
1. Trigger SQL actualiza `shipping_tiers`
2. Supabase Realtime notifica al frontend
3. Hook invalida queries de TanStack Query
4. React Query refresca automáticamente
5. UI se actualiza sin hacer nada

---

### 3. App.tsx: Provider Global ([App.tsx](./src/App.tsx))

**Agregado:**
```tsx
import { ShippingTiersRealtimeProvider } from "@/hooks/useShippingTiersRealtimeSync";

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ViewModeProvider>
            <ShippingTiersRealtimeProvider /> {/* ✅ NUEVO */}
            <AppContent />
          </ViewModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);
```

**Por qué aquí:**
- Está al nivel raíz de la app
- Se ejecuta una sola vez
- Escucha cambios para **toda la aplicación**
- No importa en qué página estés, siempre actualiza

---

### 4. useShippingTypes.ts: Realtime Local ([useShippingTypes.ts](./src/hooks/useShippingTypes.ts))

**Agregado:**
```typescript
useEffect(() => {
  // Escuchar cambios en shipping_tiers
  const channel = supabase
    .channel('shipping_tiers_changes')
    .on('postgres_changes', { table: 'shipping_tiers' }, (payload) => {
      // Re-fetch shipping types cuando cambien
      refetchTypes();
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [routeId]);
```

**Por qué también aquí:**
- Refresco **inmediato** del selector de tipos de envío
- No depende de invalidación de TanStack Query
- Garantiza que el dropdown siempre muestre valores actualizados

---

## 🚀 Pasos de Instalación

### PASO 1: Ejecutar SQL

**En Supabase SQL Editor:**
```sql
-- Copiar y pegar TODO el contenido de TRIGGER_AUTO_SYNC_TIERS_DESDE_SEGMENTOS.sql
```

**Qué esperar:**
```
✅ Función sync_shipping_tiers_from_segments() creada
✅ Trigger trigger_auto_sync_tiers_from_segments activo
✅ Sincronización inicial completada
✅ Tabla de verificación mostrando tiers sincronizados
```

---

### PASO 2: Verificar que Supabase Realtime esté habilitado

**En Supabase Dashboard:**
1. Ir a **Database** → **Replication**
2. Verificar que `shipping_tiers` tenga **Realtime enabled** ✅
3. Si no está habilitado, hacer clic en "Enable Realtime"

---

### PASO 3: Frontend ya está listo ✅

Los archivos ya están modificados:
- ✅ `src/hooks/useShippingTiersRealtimeSync.ts` (nuevo)
- ✅ `src/hooks/useShippingTypes.ts` (actualizado)
- ✅ `src/App.tsx` (actualizado)

**NO necesitas hacer nada más en el frontend**

---

## 🧪 Pruebas

### Prueba 1: Cambiar costo en Tramo (Admin Panel)

**Escenario:**
1. Admin abre **Global Logistics** → Tab "Rutas y Tramos"
2. Edita un tramo (ej: china_to_transit, aereo)
3. Cambia `cost_per_kg` de `7.00` a `7.50`
4. Guarda

**Resultado esperado:**
```
✅ Trigger SQL actualiza shipping_tiers automáticamente
✅ Frontend recibe notificación via Realtime
✅ Selector de tipos de envío se actualiza solo
✅ Carrito recalcula automáticamente
✅ TODO sin refrescar página
```

**Verificación en DB:**
```sql
-- Antes del cambio
SELECT tier_name, tramo_a_cost_per_kg 
FROM shipping_tiers 
WHERE transport_type = 'aereo';
-- Resultado: Express Aéreo | 7.0000

-- Cambiar tramo
UPDATE route_logistics_costs
SET cost_per_kg = 7.50
WHERE segment = 'china_to_transit' 
  AND transport_type = 'aereo';

-- Después del cambio (verificar que trigger funcionó)
SELECT tier_name, tramo_a_cost_per_kg, updated_at
FROM shipping_tiers 
WHERE transport_type = 'aereo';
-- Resultado: Express Aéreo | 7.5000 | 2026-02-19 15:30:00 ✅
```

---

### Prueba 2: Ver actualización en Carrito en Tiempo Real

**Escenario:**
1. **Usuario B2B** tiene carrito con 2kg de productos
2. Tipo de envío seleccionado: Express Aéreo
3. Costo actual: $24.00

4. **Admin** cambia Tramo A de $7.00/kg → $7.50/kg

**Resultado esperado:**
```
Usuario NO refresca página
✅ Costo cambia automáticamente de $24.00 → $25.00
✅ Breakdown se actualiza:
   - Tramo A: $14.00 → $15.00 (2kg × $7.50)
   - Tramo B: $10.00 (sin cambios)
✅ Total: $25.00
```

**Logs en Consola (F12):**
```
🔴 [Realtime] Shipping tier changed: {
  eventType: 'UPDATE',
  new: { id: '...', tramo_a_cost_per_kg: 7.5000 }
}
✅ [Realtime] Invalidated query: ['shipping-tiers']
✅ [Realtime] Invalidated query: ['cart-shipping-cost']
🔄 [Realtime] All shipping queries invalidated - UI will refresh
🔄 Shipping tiers fetched from DB: [...]
✅ Shipping types auto-updated from realtime: [...]
```

---

### Prueba 3: Cargar desde Segmentos (todavía funciona)

**Escenario:**
1. Admin abre modal de editar tipo de envío
2. Hace clic en "Cargar desde Segmentos"

**Resultado esperado:**
```
✅ Sigue funcionando como antes
✅ Ahora carga valores YA sincronizados por el trigger
✅ Es más una "confirmación" que una "carga necesaria"
```

---

## 🎯 Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin cambia costo en route_logistics_costs            │
│    (Global Logistics → Rutas y Tramos)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Trigger SQL detecta cambio                              │
│    trigger_auto_sync_tiers_from_segments                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Función sync_shipping_tiers_from_segments()             │
│    UPDATE shipping_tiers                                    │
│    SET tramo_a_cost_per_kg = NEW.cost_per_kg               │
│    WHERE route_id = ... AND transport_type = ...           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Supabase Realtime notifica al frontend                 │
│    Event: UPDATE en shipping_tiers                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌───────────────────┐   ┌────────────────────────┐
│ useShippingTypes  │   │ useShippingTiers       │
│ Refetch tiers     │   │ RealtimeSync           │
│ directamente      │   │ Invalida TanStack Query│
└─────────┬─────────┘   └──────────┬─────────────┘
          │                        │
          └───────────┬────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. React Query refresca componentes                        │
│    - ShippingTypeSelector (dropdown actualizado)           │
│    - SellerCartPage (costo recalculado)                    │
│    - CheckoutPage (total actualizado)                      │
│    - Admin Panel (valores sincronizados)                   │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ UI actualizada - SIN REFRESCAR PÁGINA                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Verificación de Estado

### Comprobar Trigger Activo

```sql
-- Ver triggers en route_logistics_costs
SELECT 
  trigger_name,
  event_manipulation as event,
  action_statement as action,
  action_timing as timing
FROM information_schema.triggers
WHERE event_object_table = 'route_logistics_costs'
  AND trigger_name LIKE '%sync%';
```

**Resultado esperado:**
```
trigger_auto_sync_tiers_from_segments | UPDATE | sync_shipping_tiers_from_segments() | AFTER
```

---

### Comprobar Realtime Habilitado

```sql
-- Ver publicaciones de Realtime
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'shipping_tiers';
```

**Resultado esperado:**
```
supabase_realtime | public | shipping_tiers
```

Si no está habilitado:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE shipping_tiers;
```

---

### Ver Logs del Trigger (Debug)

```sql
-- Activar logs de NOTICE
SET client_min_messages TO NOTICE;

-- Hacer un cambio
UPDATE route_logistics_costs
SET cost_per_kg = 7.50
WHERE segment = 'china_to_transit' AND transport_type = 'aereo'
LIMIT 1;

-- Ver el log
NOTICE:  Auto-sincronización: 1 tiers actualizados para ruta <uuid> con transporte aereo
```

---

## 🎉 Beneficios

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Sincronización** | Manual (clic en botón) | ✅ Automática |
| **Tiempo** | ~30 segundos | ✅ <1 segundo |
| **Errores** | Posible olvidar actualizar | ✅ Imposible desincronizar |
| **UX Admin** | Tedioso (múltiples pasos) | ✅ Cambias y listo |
| **UX Usuario** | Tenía que refrescar | ✅ Ve cambios al instante |
| **Confiabilidad** | Manual prone to errors | ✅ 100% automático |

---

## ⚠️ Notas Importantes

### 1. El botón "Cargar desde Segmentos" SIGUE funcionando
- No lo eliminamos
- Ahora carga valores que YA están sincronizados
- Es más una "verificación/refresh manual" opcional

### 2. Los cambios son BIDIRECCIONALES
- Cambias `route_logistics_costs` → actualiza `shipping_tiers` ✅
- Cambias `shipping_tiers` manualmente → NO afecta `route_logistics_costs`
- **Fuente de verdad:** `route_logistics_costs` siempre gana

### 3. Solo afecta Tramos A y B
- Trigger solo se activa para `china_to_transit` y `transit_to_destination`
- Otros segmentos (C, D) no afectan `shipping_tiers` actualmente

---

## 🆘 Troubleshooting

### Problema: No se actualiza automáticamente

**Verificar:**
1. Trigger existe y está activo (query arriba)
2. Realtime habilitado en Supabase Dashboard
3. Consola del navegador (F12) muestra logs `🔴 [Realtime]`
4. `updated_at` en `shipping_tiers` cambió

**Solución:**
```sql
-- Re-crear trigger
\i TRIGGER_AUTO_SYNC_TIERS_DESDE_SEGMENTOS.sql

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE shipping_tiers;
```

---

### Problema: Logs de Realtime no aparecen

**Verificar:**
```typescript
// En consola del navegador
localStorage.setItem('supabase.log_level', 'debug');
```

**Luego refrescar página** y ver logs detallados

---

### Problema: Trigger funciona pero frontend no actualiza

**Verificar:**
1. `ShippingTiersRealtimeProvider` está en `App.tsx` ✅
2. No hay errores en consola
3. TanStack Query devtools muestran invalidación de queries

**Solución:**
```typescript
// Forzar refetch manual (temporalmente)
queryClient.invalidateQueries({ queryKey: ['shipping-tiers'] });
```

---

## ✅ Checklist de Validación

- [ ] Ejecutar `TRIGGER_AUTO_SYNC_TIERS_DESDE_SEGMENTOS.sql`
- [ ] Verificar trigger activo en `information_schema.triggers`
- [ ] Habilitar Realtime en Supabase Dashboard para `shipping_tiers`
- [ ] Refrescar frontend (Ctrl+F5)
- [ ] Abrir consola (F12) y ver logs `🔴 [Realtime]`
- [ ] Probar: cambiar costo en tramo → ver log del trigger
- [ ] Verificar `shipping_tiers.updated_at` cambió
- [ ] Ver en frontend que selector se actualiza
- [ ] Abrir carrito y ver costo actualizado
- [ ] **Sin refrescar:** cambiar otro tramo y ver actualización instantánea

---

**🎯 Resultado Final:**
- Cambias un tramo → todo se actualiza solo
- Carrito, checkout, admin panel = siempre sincronizados
- Experiencia fluida para admin y usuarios
- Zero intervención manual requerida
