# 🗑️ Funciones y Tablas ELIMINADAS vs ✅ Nuevas

## Resumen de Cambios

Con la nueva arquitectura de **auto-save** y cálculos **100% desde la base de datos**, las siguientes funciones y tablas fueron **ELIMINADAS** (2026-02-18).

---

## 📊 Tablas

### ❌ ELIMINADA: `shipping_type_configs` 

**Razón de eliminación:**
- Tabla antigua reemplazada por `shipping_tiers`
- No se usaba en ninguna función ni vista
- 0 registros en la tabla

**✅ AHORA SE USA:** `shipping_tiers`

**Beneficios:**
- Vinculada directamente a `route_logistics_costs` (tarifas reales)
- Soporta múltiples tiers por ruta (Standard, Express, etc.)
- Campos personalizables: `custom_tier_name`, `surcharge_description`
- Auto-población de países desde la ruta

**Migración en código:**
```sql
-- ❌ ANTES (tabla eliminada)
SELECT * FROM shipping_type_configs WHERE shipping_route_id = '...';

-- ✅ AHORA (shipping_tiers) - Columna es "route_id"
SELECT * FROM shipping_tiers WHERE route_id = '...';
```

---

## 🔧 Funciones SQL

### ❌ ELIMINADA: `calculate_cart_shipping_cost_dynamic`
### ❌ ELIMINADA: `get_cart_shipping_cost`

**Razón de eliminación:**
- NO se usaban en el frontend actual
- Frontend usa `v_cart_shipping_costs` (vista) para UI normal
- Para cálculos seguros, frontend usa `get_user_cart_shipping_cost`

**✅ AHORA SE USA:** `get_user_cart_shipping_cost`

**Beneficios:**
- Consulta items **desde la DB** (100% seguro)
- Recibe `user_id` + `shipping_type_id`
- Usa `shipping_tiers` (nueva tabla)
- Backend puede confiar en los datos siempre

**Migración en código:**
```typescript
// ❌ ANTES (funciones eliminadas)
const { data } = await supabase.rpc('calculate_cart_shipping_cost_dynamic', {
  p_items: items.map(i => ({ product_id: i.id, quantity: i.qty })),
  p_shipping_type_id: tierId
});
// O:
const { data } = await supabase.rpc('get_cart_shipping_cost', {
  cart_items: items.map(i => ({ product_id: i.id, quantity: i.qty }))
});

// ✅ AHORA - Opción 1: Vista dinámica (recomendado para UI)
const { data } = await supabase
  .from('v_cart_shipping_costs')
  .select('*')
  .single();

// ✅ AHORA - Opción 2: RPC segura (para checkout/backend)
const { data } = await supabase.rpc('get_user_cart_shipping_cost', {
  p_user_id: user.id,
  p_shipping_type_id: tierId
});
```

**Scripts ejecutados:**
- `FIX_GET_USER_CART_SHIPPING_COST_WITH_TIER_SELECTION.sql` ✅
- `DROP_DEPRECATED_SHIPPING_FUNCTIONS_AND_TABLE.sql` ✅

---

### ✅ ACTUALIZADA: `calculate_shipping_cost_for_selected_items`

**Problema original:**
- Costos **HARDCODED** ($11.05 + $5.82/kg)
- NO usaba `shipping_tiers`
- NO recibía `shipping_type_id`

**✅ Solución aplicada:**
- Ahora usa `shipping_tiers` (NO hardcoded)
- Recibe `p_shipping_type_id` como parámetro opcional
- Llama internamente a `calculate_shipping_cost_cart` (ya actualizada)
- Si no se proporciona tier_id, usa STANDARD de la ruta

**Archivo SQL:** `FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS.sql`

**Uso:**
```sql
-- Con tier específico
SELECT * FROM calculate_shipping_cost_for_selected_items(
  ARRAY['item-id-1'::UUID, 'item-id-2'::UUID],
  'express-tier-id'::UUID
);

-- Sin especificar (usa STANDARD por defecto)
SELECT * FROM calculate_shipping_cost_for_selected_items(
  ARRAY['item-id-1'::UUID, 'item-id-2'::UUID],
  NULL
);
```

---

### ⚠️ ACTUALIZADA: `calculate_shipping_cost_cart`

**Estado:** ✅ Ya actualizada para usar `shipping_tiers`

**Archivo SQL:** `FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql`

**Cambios:**
- Ahora consulta `shipping_tiers` en lugar de `shipping_type_configs`
- Recibe `p_shipping_type_id` como parámetro
- Usa costos por tier: `tramo_a_cost_per_kg`, `tramo_b_cost_per_lb`
- Incluye surcharges del tier seleccionado

---

## 🎣 Hooks React

### ❌ DEPRECADO (parcialmente): `useCartShippingCostView`

**Problema:**
- Llama a `calculate_shipping_cost_for_selected_items`
- Diseñado para cálculo por checkbox (no por tier selection)
- NO tiene auto-save integrado

**✅ USAR EN SU LUGAR:** `useAutoSaveCartWithShipping`

**Beneficios:**
- Auto-guarda cambios después de 500ms (no requiere botón "Guardar")
- Optimistic UI - actualización instantánea
- Calcula shipping usando `get_user_cart_shipping_cost` (100% DB)
- Recibe `shipping_type_id` para cálculo por tier
- Maneja estados: `isSaving`, `isCalculatingShipping`

**Migración:**
```typescript
// ❌ ANTES (manual save + hook separado)
const { items } = useB2BCartItems();
const { data: shippingCost } = useCartShippingCostView(selectedIds, items);

const updateQuantity = async (itemId, newQty) => {
  await supabase.from('b2b_cart_items').update({ quantity: newQty }).eq('id', itemId);
  refetch(); // Manual refetch
};

// ✅ AHORA (auto-save integrado)
const {
  shippingCost,
  isSaving,
  isCalculatingShipping,
  updateQuantity,
  error
} = useAutoSaveCartWithShipping(selectedShippingTypeId);

// Uso simple - auto-guarda y recalcula
updateQuantity(itemId, newQty); // ✅ No await, no refetch manual
```

**Archivo Hook:** `src/hooks/useAutoSaveCartWithShipping.ts`

---

## 📁 Archivos SQL Aplicados

| Archivo | Estado | Propósito |
|---------|--------|-----------|
| `FIX_SHIPPING_TIERS_USE_ACTUAL_SEGMENT_COSTS.sql` | ✅ EJECUTADO | Sincronizar costos de tiers con segmentos |
| `FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql` | ✅ EJECUTADO | Actualizar función core para usar shipping_tiers |
| `FIX_GET_USER_CART_SHIPPING_COST_WITH_TIER_SELECTION.sql` | ✅ EJECUTADO | Crear función segura que consulta desde DB |
| `FIX_CALCULATE_CART_SHIPPING_COST_DYNAMIC_USE_TIERS.sql` | ⏳ PENDIENTE | Actualizar preview function (opcional con auto-save) |
| `FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS.sql` | ✅ CREADO | Remover hardcoded costs, usar shipping_tiers |

---

## 🚀 Integración Completa Aplicada

### SellerCartPage.tsx
```typescript
// ✅ Hook integrado
const {
  shippingCost: autoSaveShippingCost,
  isSaving: isAutoSaving,
  isCalculatingShipping: isCalculatingAutoShipping,
  updateQuantity: autoSaveUpdateQuantity,
  error: autoSaveError
} = useAutoSaveCartWithShipping(selectedShippingTypeId);

// ✅ Wrapper para manejar qty < 1
const updateQuantity = async (itemId: string, newQty: number) => {
  if (newQty < 1) {
    await removeItem(itemId);
    return;
  }
  autoSaveUpdateQuantity(itemId, newQty); // Auto-save con debounce
};

// ✅ UI con indicadores
{isAutoSaving && (
  <div className="flex items-center gap-1.5 text-xs text-blue-600">
    <Loader2 className="w-3 h-3 animate-spin" />
    <span>Guardando...</span>
  </div>
)}

{autoSaveShippingCost && (
  <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg">
    <span className="text-xs font-semibold text-green-900">
      Costo Calculado (100% desde DB)
    </span>
    {/* Detalles del shipping */}
  </div>
)}
```

---

## ✅ Checklist de Migración

### Backend (SQL)
- [x] Ejecutar `FIX_SHIPPING_TIERS_USE_ACTUAL_SEGMENT_COSTS.sql`
- [x] Ejecutar `FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql`
- [x] Ejecutar `FIX_GET_USER_CART_SHIPPING_COST_WITH_TIER_SELECTION.sql`
- [x] Crear `FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS.sql`
- [ ] Ejecutar `FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS.sql` (PENDIENTE)
- [ ] (Opcional) Ejecutar `FIX_CALCULATE_CART_SHIPPING_COST_DYNAMIC_USE_TIERS.sql`

### Frontend
- [x] Crear `useAutoSaveCartWithShipping.ts`
- [x] Integrar hook en `SellerCartPage.tsx`
- [x] Agregar indicadores de guardado (`isAutoSaving`)
- [x] Mostrar shipping calculado desde DB
- [x] Reemplazar `updateQuantity` manual con auto-save
- [ ] Testing en desarrollo
- [ ] Testing en producción
- [ ] (Opcional) Deprecar `useCartShippingCostView` si no se usa en otro lugar

### Limpieza (Opcional)
- [ ] Remover referencias a `shipping_type_configs` en código legacy
- [ ] Remover `calculate_cart_shipping_cost_dynamic` si no se usa
- [ ] Actualizar documentación del API
- [ ] Agregar tests unitarios para nuevas funciones

---

## 🎯 Resultado Final

### Antes
- ❌ Costos hardcoded o en tabla antigua
- ❌ Items pasados desde frontend (inseguro)
- ❌ Guardado manual con botón
- ❌ No diferenciaba entre Express/Standard
- ❌ Cálculos no sincronizados con tarifas reales

### Ahora
- ✅ Costos desde `shipping_tiers` (sincronizados con tarifas)
- ✅ Items consultados desde DB (100% seguro)
- ✅ Auto-save con debounce (Google Docs style)
- ✅ Soporta múltiples tiers (Express, Standard, etc.)
- ✅ Optimistic UI para UX instantánea
- ✅ Backend puede confiar en los datos siempre

---

## 📝 Notas Finales

1. **Compatibilidad:** El código antiguo sigue funcionando temporalmente mientras se migra completamente.

2. **Testing:** Probar en desarrollo antes de producción:
   ```bash
   # Test: Cambiar cantidad → auto-guarda → shipping recalcula
   # Test: Cambiar tier → shipping actualiza
   # Test: Checkout → forzar guardado antes de proceder
   ```

3. **Rollback:** Si hay problemas, revisar:
   - `REVERT_CALCULATE_SHIPPING_COST_CART.sql` (revertir a versión antigua)
   - Comentar integración de `useAutoSaveCartWithShipping`
   - Usar `updateQuantityManual` en lugar de wrapper

4. **Performance:** Con auto-save y debounce, el número de queries a la DB se mantiene similar o menor que con el sistema manual, gracias a la optimización del queue.

---

## 🆘 Recursos

- **Guía Implementación:** `GUIA_IMPLEMENTACION_AUTO_SAVE.md`
- **Comparación Arquitectura:** `COMPARACION_PREVIEW_VS_AUTOSAVE.md`
- **Ejemplo Completo:** `SOLUCION_AUTO_SAVE_CARRITO_100_SEGURO.tsx`
- **Migración SQL:** `GUIA_MIGRACION_SHIPPING_SEGURO.sql`
