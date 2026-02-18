# 🔧 Guía de Implementación: Route ID en Carritos

## 📋 Resumen del Cambio

Permitir que cada carrito B2B guarde su ruta de envío seleccionada, en lugar de usar siempre la ruta hardcoded (China → Haití).

## 🎯 Archivos SQL Creados

### 1. `ADD_ROUTE_ID_TO_B2B_CARTS.sql`
Agrega la columna `route_id` a la tabla `b2b_carts`.

### 2. `FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS_USE_CART_ROUTE.sql`
Actualiza la función para leer `route_id` desde el carrito.

### 3. `FIX_GET_USER_CART_SHIPPING_COST_USE_CART_ROUTE.sql`
Actualiza la función para leer `route_id` desde el carrito.

---

## 🚀 Orden de Ejecución (Supabase SQL Editor)

### **PASO 1: Agregar columna route_id a b2b_carts**

```sql
-- Ejecutar: ADD_ROUTE_ID_TO_B2B_CARTS.sql
```

**Descripción:**
- Agrega columna `route_id` a `b2b_carts` con foreign key a `shipping_routes`
- Establece ruta por defecto (China → Haití) para carritos existentes
- Crea índice para mejorar performance

**Resultado esperado:**
```
✅ Columna route_id agregada a b2b_carts
🔗 Foreign key a shipping_routes configurado
📍 Carritos existentes tienen ruta por defecto
⚡ Índice creado para mejor performance
```

---

### **PASO 2: Actualizar calculate_shipping_cost_for_selected_items**

```sql
-- Ejecutar: FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS_USE_CART_ROUTE.sql
```

**Descripción:**
- Actualiza función para leer `bc.route_id` en lugar de usar hardcoded
- Mantiene fallback a ruta por defecto si `route_id` es NULL

**Resultado esperado:**
```
✅ Función calculate_shipping_cost_for_selected_items ACTUALIZADA
🔧 Ahora lee route_id desde b2b_carts.route_id
🌍 Ya NO usa ruta hardcoded (solo como fallback)
```

---

### **PASO 3: Actualizar get_user_cart_shipping_cost**

```sql
-- Ejecutar: FIX_GET_USER_CART_SHIPPING_COST_USE_CART_ROUTE.sql
```

**Descripción:**
- Actualiza función para leer `route_id` desde el carrito del usuario
- Mantiene fallback a ruta por defecto si no hay ruta

**Resultado esperado:**
```
✅ Función get_user_cart_shipping_cost actualizada
🔧 Ahora lee route_id desde b2b_carts.route_id
🌍 Ya NO usa ruta hardcoded (solo como fallback)
```

---

## 🔍 Verificación Post-Implementación

### 1. Verificar estructura de b2b_carts

```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'b2b_carts'
  AND column_name = 'route_id';
```

**Resultado esperado:**
| column_name | data_type | is_nullable |
|------------|-----------|-------------|
| route_id   | uuid      | YES         |

### 2. Verificar carritos con rutas

```sql
SELECT 
  bc.id,
  bc.buyer_user_id,
  bc.route_id,
  sr.name as route_name,
  CONCAT(sr.origin_country, ' → ', sr.destination_country) as ruta
FROM b2b_carts bc
LEFT JOIN shipping_routes sr ON bc.route_id = sr.id
WHERE bc.status = 'open'
LIMIT 5;
```

### 3. Test de calculate_shipping_cost_for_selected_items

```sql
-- Obtener IDs de items en tu carrito
SELECT 
  bci.id,
  bci.sku,
  bci.nombre,
  bc.route_id
FROM b2b_cart_items bci
JOIN b2b_carts bc ON bci.cart_id = bc.id
WHERE bc.buyer_user_id = auth.uid()
LIMIT 3;

-- Calcular shipping (reemplaza con tus item IDs)
SELECT calculate_shipping_cost_for_selected_items(
  ARRAY[
    'item-id-1'::UUID,
    'item-id-2'::UUID
  ]::UUID[],
  NULL  -- tier_id (NULL = usa STANDARD)
);
```

### 4. Test de get_user_cart_shipping_cost

```sql
-- Reemplaza con tu user_id
SELECT get_user_cart_shipping_cost(
  '376067ef-7629-47f1-be38-bbf8d728ddf0'::UUID,
  NULL  -- tier_id (NULL = usa STANDARD)
);
```

---

## 🔧 Cambios Pendientes en Frontend

### 1. **Guardar ruta seleccionada en el carrito**

Cuando el usuario seleccione una ruta en el frontend, actualizar el carrito:

```typescript
// src/hooks/useUpdateCartRoute.ts (NUEVO HOOK)
export function useUpdateCartRoute() {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cartId, routeId }: { cartId: string; routeId: string }) => {
      const { error } = await supabase
        .from('b2b_carts')
        .update({ route_id: routeId })
        .eq('id', cartId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidar queries de shipping para recalcular con nueva ruta
      queryClient.invalidateQueries({ queryKey: ['cart-shipping-cost'] });
      queryClient.invalidateQueries({ queryKey: ['user-cart-shipping-cost'] });
    },
  });
}
```

### 2. **Uso en componente de selección de ruta**

```typescript
// En tu componente donde el usuario selecciona la ruta
function RouteSelector() {
  const { data: cart } = useCart();
  const updateRoute = useUpdateCartRoute();
  
  const handleRouteChange = (newRouteId: string) => {
    if (cart?.id) {
      updateRoute.mutate({
        cartId: cart.id,
        routeId: newRouteId,
      });
    }
  };

  return (
    <Select onValueChange={handleRouteChange} defaultValue={cart?.route_id}>
      {/* Opciones de rutas */}
    </Select>
  );
}
```

### 3. **Inicializar carrito con ruta por defecto**

Cuando se crea un nuevo carrito, establecer la ruta:

```typescript
// Al crear carrito
const { data: newCart } = await supabase
  .from('b2b_carts')
  .insert({
    buyer_user_id: userId,
    status: 'open',
    route_id: '21420dcb-9d8a-4947-8530-aaf3519c9047', // China → Haití
  })
  .select()
  .single();
```

---

## ✅ Checklist de Implementación

### Base de Datos
- [ ] **Paso 1:** Ejecutar `ADD_ROUTE_ID_TO_B2B_CARTS.sql`
- [ ] **Paso 2:** Ejecutar `FIX_CALCULATE_SHIPPING_COST_FOR_SELECTED_ITEMS_USE_CART_ROUTE.sql`
- [ ] **Paso 3:** Ejecutar `FIX_GET_USER_CART_SHIPPING_COST_USE_CART_ROUTE.sql`
- [ ] Verificar que la columna `route_id` existe en `b2b_carts`
- [ ] Verificar que funciones se ejecutan sin errores

### Frontend
- [ ] Crear hook `useUpdateCartRoute`
- [ ] Agregar selector de ruta en página del carrito
- [ ] Actualizar creación de carrito para incluir `route_id` por defecto
- [ ] Test: Cambiar ruta y verificar que shipping se recalcula
- [ ] Test: Crear nuevo carrito y verificar que tiene ruta por defecto

### Testing
- [ ] Test 1: Crear carrito nuevo → Debe tener ruta por defecto
- [ ] Test 2: Cambiar ruta → Shipping debe recalcularse
- [ ] Test 3: Agregar items → Shipping debe usar ruta del carrito
- [ ] Test 4: Finalizar orden → Debe usar ruta correcta

---

## 🚨 Notas Importantes

### ⚠️ **Orden de Ejecución Crítico**

Los archivos SQL **DEBEN** ejecutarse en el orden especificado:
1. Primero agregar la columna (`ADD_ROUTE_ID_TO_B2B_CARTS.sql`)
2. Luego actualizar las funciones que la usan

Si ejecutas fuera de orden, las funciones fallarán porque intentarán leer una columna que no existe.

### 🔒 **Seguridad**

- Frontend solo puede actualizar `route_id` del carrito del usuario autenticado
- Las funciones siempre leen desde la DB (no confían en datos del frontend)
- Si `route_id` es NULL, se usa fallback automático a China → Haití

### 📍 **Fallback Automático**

Si un carrito no tiene `route_id` (NULL), las funciones automáticamente usan:
- **Ruta por defecto:** China → Haití
- **UUID:** `21420dcb-9d8a-4947-8530-aaf3519c9047`

Esto garantiza que el sistema siempre funcione, incluso si hay carritos antiguos sin ruta.

---

## 🎉 Resultado Final

Después de implementar estos cambios:

✅ Cada carrito puede tener su propia ruta de envío  
✅ Usuario puede cambiar la ruta y el shipping se recalcula automáticamente  
✅ Las funciones leen la ruta desde el carrito (no hardcoded)  
✅ Sistema mantiene compatibilidad con carritos antiguos (fallback)  
✅ 100% seguro - frontend no puede manipular cálculos  

---

## 📞 Troubleshooting

### Error: "column route_id does not exist"
**Causa:** No ejecutaste `ADD_ROUTE_ID_TO_B2B_CARTS.sql`  
**Solución:** Ejecuta el Paso 1 primero

### Error: "function does not exist"
**Causa:** Las funciones antiguas todavía existen  
**Solución:** Los scripts incluyen DROP FUNCTION, ejecuta de nuevo

### Shipping no se recalcula al cambiar ruta
**Causa:** Frontend no está invalidando queries  
**Solución:** Verifica que `invalidateQueries` se ejecuta después de actualizar ruta

---

**Creado:** 2026-02-18  
**Versión:** 1.0  
**Autor:** GitHub Copilot
