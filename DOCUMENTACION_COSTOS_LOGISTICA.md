# 📊 ESTRUCTURA COMPLETA: COSTOS DE LOGÍSTICA B2B

## 🎯 Resumen Ejecutivo

El sistema calcula costos de envío basándose en:
1. **Peso del producto** (auto-calculado al agregar al carrito)
2. **Tarifas configurables** (del módulo Logística Global)
3. **Selección del usuario** (solo items con checkbox marcado)

---

## 📐 FÓRMULA DE CÁLCULO

```
COSTO TOTAL = TRAMO A + TRAMO B

Donde:
  Tramo A = peso_kg × tramo_a_cost_per_kg    (China → Hub USA)
  Tramo B = peso_lb × tramo_b_cost_per_lb    (Hub USA → Haití)
  
  peso_lb = peso_kg × 2.20462
  peso_kg = CEIL(suma de todos los items seleccionados)
```

**Ejemplo con 2 kg:**
- Tramo A: 2 kg × $4.00 = $8.00
- Tramo B: 4.41 lb × $3.20 = $14.11
- **TOTAL: $22.11**

---

## 🗂️ TABLAS PRINCIPALES

### 1. **products** & **product_variants**
**Propósito:** Almacenan peso de los productos

```sql
products:
  - peso_kg, peso_g, weight_kg, weight_g

product_variants:
  - peso_kg, peso_g
```

**Prioridad de peso:**
1. `product_variants.peso_kg`
2. `products.peso_kg`
3. `product_variants.peso_g / 1000`
4. `products.peso_g / 1000`

---

### 2. **b2b_cart_items**
**Propósito:** Items en el carrito con peso auto-calculado

```sql
b2b_cart_items:
  - id (UUID)
  - cart_id (FK)
  - product_id (FK)
  - variant_id (FK nullable)
  - quantity (INT)
  - peso_kg (NUMERIC) ← AUTO-CALCULADO por trigger
```

**Trigger automático:** `trg_auto_peso_b2b`
- Se ejecuta: `BEFORE INSERT OR UPDATE`
- Función: `fn_auto_set_peso_kg()`
- Acción: Copia peso desde products/variants

---

### 3. **shipping_tiers**
**Propósito:** Tarifas configurables del módulo Logística Global

```sql
shipping_tiers:
  - id (UUID)
  - tier_type ('standard' | 'express')
  - tier_name (TEXT)
  - tramo_a_cost_per_kg (NUMERIC) ← $4.00/kg (China → USA)
  - tramo_b_cost_per_lb (NUMERIC) ← $3.20/lb (USA → Haití)
  - is_active (BOOLEAN)
```

**Configuración actual:**
- ❌ **SIN TARIFAS CONFIGURADAS** (detectado en verificación)
- ⚠️ Fallback activo: Tramo A = $4.00/kg, Tramo B = $2.50/lb
- ✅ Se puede configurar desde **Admin Panel > Global Logistics**

---

### 4. **shipping_routes**
**Propósito:** Rutas de envío disponibles

```sql
shipping_routes:
  - id (UUID)
  - route_name (TEXT) ej: "CHINA → HAITI"
  - origin_country (TEXT)
  - destination_country (TEXT)
  - is_active (BOOLEAN)
```

---

## ⚡ FUNCIONES Y TRIGGERS

### Trigger: `trg_auto_peso_b2b`
**Archivo:** `INSTALAR_TRIGGER_PESO_AUTOMATICO.sql`

```sql
CREATE TRIGGER trg_auto_peso_b2b
BEFORE INSERT OR UPDATE ON b2b_cart_items
FOR EACH ROW
EXECUTE FUNCTION fn_auto_set_peso_kg();
```

**Qué hace:**
- Se ejecuta automáticamente al agregar/actualizar item
- Busca peso en product_variants o products
- Lo guarda en `b2b_cart_items.peso_kg`

---

### Función: `fn_auto_set_peso_kg()`
**Archivo:** `INSTALAR_TRIGGER_PESO_AUTOMATICO.sql`

**Lógica:**
```sql
NEW.peso_kg := COALESCE(
  pv.peso_kg,           -- 1. Peso de variante en kg
  p.peso_kg,            -- 2. Peso de producto en kg
  pv.peso_g / 1000.0,   -- 3. Peso de variante en g → kg
  p.peso_g / 1000.0,    -- 4. Peso de producto en g → kg
  0                     -- 5. Fallback
);
```

---

### Función RPC: `calculate_shipping_cost_for_selected_items()`
**Archivo:** `ACTUALIZAR_FUNCION_CON_LOGISTICA_GLOBAL.sql`

**Firma:**
```sql
CREATE FUNCTION calculate_shipping_cost_for_selected_items(
  p_item_ids UUID[]
) RETURNS JSON
```

**Proceso:**
1. **Validar entrada** (array no vacío)
2. **Sumar pesos** de items seleccionados:
   ```sql
   SELECT SUM(peso_kg × quantity)
   FROM b2b_cart_items
   WHERE id = ANY(p_item_ids)
   ```
3. **Redondear hacia arriba:** `CEIL(total_weight)`
4. **Obtener tarifas:**
   ```sql
   SELECT tramo_a_cost_per_kg, tramo_b_cost_per_lb
   FROM shipping_tiers
   WHERE tier_type = 'standard' AND is_active = TRUE
   ```
5. **Calcular costos:**
   - Tramo A: `peso_kg × tramo_a_cost_per_kg`
   - Tramo B: `(peso_kg × 2.20462) × tramo_b_cost_per_lb`
6. **Retornar JSON:**
   ```json
   {
     "total_items": 3,
     "total_weight_kg": 1.3,
     "weight_rounded_kg": 2,
     "weight_lb": 4.41,
     "shipping_cost_usd": 22.11,
     "cost_breakdown": {
       "tramo_a_usd": 8.00,
       "tramo_a_rate": 4.00,
       "tramo_b_usd": 14.11,
       "tramo_b_rate": 3.20
     }
   }
   ```

---

## 🎨 FRONTEND (React + TypeScript)

### Hook: `useCartShippingCostView`
**Archivo:** `src/hooks/useCartShippingCostView.ts`

**Propósito:** Consulta costo de envío para items seleccionados

```typescript
export function useCartShippingCostView(
  selectedItemIds: Set<string>
) {
  const itemIdsArray = Array.from(selectedItemIds);
  
  return useQuery({
    queryKey: ['cart-shipping-cost', itemIdsArray],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('calculate_shipping_cost_for_selected_items', {
          p_item_ids: itemIdsArray
        });
      
      return data;
    },
    enabled: itemIdsArray.length > 0
  });
}
```

**Características:**
- ✅ TanStack Query: Auto-refetch cuando cambia selección
- ✅ Deshabilitado si no hay items seleccionados
- ✅ Cache automático

---

### Store: `useCartSelectionStore`
**Archivo:** `src/stores/useCartSelectionStore.ts`

**Propósito:** Mantener IDs de items seleccionados

```typescript
interface CartSelectionStore {
  b2bSelectedIds: Set<string>;
  b2cSelectedIds: Set<string>;
  toggleB2BItem: (id: string) => void;
  selectAllB2B: (ids: string[]) => void;
  clearB2BSelection: () => void;
}
```

---

### Componente: `SellerCartPage.tsx`
**Archivo:** `src/pages/seller/SellerCartPage.tsx`

**Uso del hook:**
```typescript
const { b2bSelectedIds } = useCartSelectionStore();

const { 
  data: shippingCostData, 
  isLoading: isLoadingShipping 
} = useCartShippingCostView(b2bSelectedIds);

const shippingCost = shippingCostData?.shipping_cost_usd || 0;
```

**Renderizado:**
```tsx
<div>
  Costo de envío: ${shippingCost.toFixed(2)}
</div>
```

---

### Hook: `useB2BCartItems`
**Archivo:** `src/hooks/useB2BCartItems.ts`

**Propósito:** Cargar items del carrito con Realtime

```typescript
// Suscripción a cambios en tiempo real
useEffect(() => {
  const subscription = supabase
    .channel('b2b_cart_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'b2b_cart_items' },
      () => queryClient.invalidateQueries(['b2b-cart-items'])
    )
    .subscribe();
    
  return () => subscription.unsubscribe();
}, []);
```

---

## 🔴 REALTIME (Supabase)

### Tablas con Realtime habilitado
**Archivo:** `HABILITAR_REALTIME_CARRITO.sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_cart_items;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_carts;
```

**Qué hace:**
- Notifica al frontend cuando se inserta/actualiza/elimina un item
- Frontend re-fetcha automáticamente
- Usuario ve cambios sin hacer refresh

---

## 📁 ARCHIVOS CLAVE

### SQL (Backend)
1. **INSTALAR_TRIGGER_PESO_AUTOMATICO.sql**
   - Crea `fn_auto_set_peso_kg()`
   - Crea trigger `trg_auto_peso_b2b`
   
2. **ACTUALIZAR_FUNCION_CON_LOGISTICA_GLOBAL.sql**
   - Actualiza `calculate_shipping_cost_for_selected_items()`
   - Integra con `shipping_tiers`
   
3. **HABILITAR_REALTIME_CARRITO.sql**
   - Habilita Realtime en `b2b_cart_items` y `b2b_carts`
   
4. **CONFIGURAR_TARIFAS_STANDARD.sql**
   - Inserta tarifas en `shipping_tiers`
   - Crea ruta en `shipping_routes`

### TypeScript (Frontend)
1. **src/hooks/useCartShippingCostView.ts**
   - Hook para calcular costo
   
2. **src/hooks/useB2BCartItems.ts**
   - Hook para cargar items con Realtime
   
3. **src/stores/useCartSelectionStore.ts**
   - Store para items seleccionados
   
4. **src/pages/seller/SellerCartPage.tsx**
   - Página principal del carrito

---

## 🔧 CONFIGURACIÓN

### ¿Cómo cambiar tarifas?

**Opción 1: Admin Panel (Recomendado)**
```
1. Ir a: Admin Panel > Global Logistics
2. Editar shipping_tiers
3. Cambiar tramo_a_cost_per_kg o tramo_b_cost_per_lb
4. Guardar
5. ¡El carrito se actualiza automáticamente!
```

**Opción 2: SQL directo**
```sql
UPDATE shipping_tiers
SET 
  tramo_a_cost_per_kg = 5.00,
  tramo_b_cost_per_lb = 4.00
WHERE tier_type = 'standard';
```

---

## ⚠️ ESTADO ACTUAL

### ✅ Completado
- [x] Trigger para peso automático
- [x] Función RPC integrada con Logística Global
- [x] Hook frontend con selección
- [x] Realtime habilitado
- [x] Cálculo solo para items seleccionados

### ❌ Pendiente
- [ ] Configurar tarifas en `shipping_tiers`
- [ ] Crear ruta en `shipping_routes`
- [ ] Probar en navegador

### 🔴 Problema detectado
**Sin tarifas configuradas**
- Actualmente usa fallback: $4.00/kg + $2.50/lb
- Necesita ejecutar: `CONFIGURAR_TARIFAS_STANDARD.sql`

---

## 🧪 TESTING

### Script de verificación
```sql
-- Ver tarifas actuales
SELECT * FROM shipping_tiers WHERE is_active = TRUE;

-- Ver items en carrito
SELECT 
  id, 
  product_id, 
  variant_id, 
  quantity, 
  peso_kg
FROM b2b_cart_items 
WHERE cart_id = (SELECT id FROM b2b_carts WHERE buyer_user_id = auth.uid());

-- Probar cálculo
SELECT calculate_shipping_cost_for_selected_items(
  ARRAY['item-uuid-1', 'item-uuid-2']::UUID[]
);
```

---

## 🎓 CONCEPTOS CLAVE

### ¿Qué es Tramo A y Tramo B?

**Tramo A: China → Hub USA**
- Transporte marítimo o aéreo internacional
- Costo por kilogramo (kg)
- Ejemplo: $4.00/kg
- Tiempo: 15-25 días (marítimo)

**Tramo B: Hub USA → Haití**
- Transporte terrestre/aéreo local
- Costo por libra (lb)
- Ejemplo: $3.20/lb
- Tiempo: 3-7 días

### ¿Por qué redondear hacia arriba?
Las compañías de envío cobran por kg completo:
- 0.1 kg → 1 kg
- 1.3 kg → 2 kg
- 5.9 kg → 6 kg

### ¿Por qué usar tier_type = 'standard'?
Es la tarifa por defecto para B2B:
- **standard:** Envío regular (más económico)
- **express:** Envío rápido (más caro, no oversize)

---

## 📞 SOPORTE

### Archivos de diagnóstico
1. `VERIFICAR_MODULO_LOGISTICA_GLOBAL.sql` - Compara sistemas
2. `VER_TARIFAS_ACTUALES.sql` - Ver configuración
3. `BUSCAR_TARIFAS_CORREGIDO.sql` - Buscar todas las tarifas

### Logs importantes
```typescript
// En navegador (F12 → Console)
console.log('Selected IDs:', b2bSelectedIds);
console.log('Shipping cost:', shippingCostData);
```

---

## 🚀 PRÓXIMOS PASOS

1. ✅ **Ejecutar:** `CONFIGURAR_TARIFAS_STANDARD.sql`
2. ✅ **Verificar:** Que se crearon las tarifas
3. ✅ **Recargar:** Aplicación en navegador (F5)
4. ✅ **Probar:** Agregar productos, marcar checkboxes
5. ✅ **Validar:** Que el costo se actualiza automáticamente

---

**Última actualización:** 2026-02-13
**Versión:** 2.0 (con Logística Global integrada)
