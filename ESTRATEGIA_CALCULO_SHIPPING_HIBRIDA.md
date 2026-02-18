# Estrategia Híbrida para Cálculo de Shipping

## 🎯 Problema Resuelto

Necesitamos **2 tipos de cálculos** diferentes:

1. **Preview en Tiempo Real** - Mientras el usuario edita el carrito
2. **Costo Final Validado** - Al hacer checkout o crear órdenes

---

## ✅ SOLUCIÓN: Usar la función correcta según el contexto

### 📊 Tabla de Decisión

| Situación | Función a Usar | ¿Por qué? |
|-----------|---------------|-----------|
| Usuario cambia cantidad (UI) | `get_cart_shipping_cost()` | Necesita ver costo INMEDIATAMENTE (antes de guardar) |
| Checkout / Crear Orden | `get_user_cart_shipping_cost()` | Costo validado desde DB (seguro) |
| Backend Jobs / Admin | `get_user_cart_shipping_cost()` | Solo necesitas user_id |
| Cálculo en servidor | `get_user_cart_shipping_cost()` | Datos 100% de la DB |

---

## 🔄 FUNCIÓN 1: Preview en Tiempo Real

### `get_cart_shipping_cost(cart_items, shipping_type_id)`

**Cuándo usar:**
- ✅ Usuario cambia cantidad de 2 a 5 (no guardado)
- ✅ Usuario agrega/quita items temporalmente
- ✅ Necesitas mostrar costo AHORA (no esperar guardar)
- ✅ Preview/estimación antes de guardar cambios

**Ventajas:**
- ⚡ Instantáneo - no requiere guardar en DB
- 🎨 Mejor UX - usuario ve costo en tiempo real
- 🔄 Flexible - calcula con cualquier combinación de items

**Limitaciones:**
- ⚠️ Items vienen del frontend (puede ser manipulado)
- ⚠️ Solo para PREVIEW - nunca para checkout final
- ⚠️ Backend debe recalcular antes de procesar pago

**Ejemplo:**

```typescript
// PREVIEW: Calcular mientras usuario edita
const [cartItems, setCartItems] = useState([
  { productId: 'abc', quantity: 2 },
  { productId: 'def', quantity: 3 }
]);

const [previewCost, setPreviewCost] = useState(0);

useEffect(() => {
  async function updatePreview() {
    const { data } = await supabase.rpc('get_cart_shipping_cost', {
      cart_items: cartItems.map(item => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity  // Cantidad temporal del UI
      })),
      p_shipping_type_id: selectedTierId
    });
    
    setPreviewCost(data?.total_cost_with_type || 0);
  }
  
  updatePreview();
}, [cartItems, selectedTierId]);  // Recalcula cuando cambian

// Mostrar en UI
<p>Shipping estimado: ${previewCost.toFixed(2)}</p>
```

---

## 💰 FUNCIÓN 2: Costo Final Validado

### `get_user_cart_shipping_cost(user_id, shipping_type_id)`

**Cuándo usar:**
- ✅ Checkout final
- ✅ Crear orden de compra
- ✅ Generar factura
- ✅ Backend/APIs
- ✅ Jobs automáticos
- ✅ Dashboard admin

**Ventajas:**
- 🔒 100% seguro - datos desde DB
- ✅ No manipulable desde frontend
- ✅ Refleja el carrito guardado real
- ✅ Solo necesitas user_id + tier_id

**Limitaciones:**
- 📊 Solo calcula con items guardados en `b2b_cart_items`
- ⏱️ Si usuario no guardó cambios, no los verá

**Ejemplo:**

```typescript
// CHECKOUT: Costo final validado
async function handleCheckout() {
  const { data: { user } } = await supabase.auth.getUser();
  
  // ✅ Calcular costo REAL desde DB
  const { data: finalCost } = await supabase.rpc('get_user_cart_shipping_cost', {
    p_user_id: user.id,
    p_shipping_type_id: selectedTierId
  });
  
  if (!finalCost) {
    alert('Error calculando costo de envío');
    return;
  }
  
  // Crear orden con costo validado (no manipulable)
  const { error } = await supabase.from('orders').insert({
    user_id: user.id,
    shipping_cost: finalCost.total_cost_with_type,
    shipping_type_id: selectedTierId,
    total_weight_kg: finalCost.total_weight_kg,
    // ... otros campos
  });
  
  if (!error) {
    router.push('/order-confirmation');
  }
}
```

---

## 🔄 Flujo Completo en el Frontend

```typescript
function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState(null);
  const [previewCost, setPreviewCost] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // 1️⃣ PREVIEW: Calcular en tiempo real mientras edita
  useEffect(() => {
    async function calculatePreview() {
      if (cartItems.length === 0 || !selectedTierId) return;
      
      const { data } = await supabase.rpc('get_cart_shipping_cost', {
        cart_items: cartItems.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity
        })),
        p_shipping_type_id: selectedTierId
      });
      
      setPreviewCost(data?.total_cost_with_type || 0);
    }
    
    calculatePreview();
  }, [cartItems, selectedTierId]);

  // 2️⃣ GUARDAR: Sincronizar cambios a la DB
  async function handleSaveCart() {
    setIsSaving(true);
    
    // Guardar cambios en b2b_cart_items
    for (const item of cartItems) {
      await supabase
        .from('b2b_cart_items')
        .upsert({
          cart_id: currentCartId,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity
        });
    }
    
    setIsSaving(false);
    toast.success('Carrito guardado');
  }

  // 3️⃣ CHECKOUT: Calcular costo FINAL desde DB
  async function handleCheckout() {
    // Primero, guardar cambios si hay pendientes
    if (hasUnsavedChanges) {
      await handleSaveCart();
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Calcular costo VALIDADO desde DB
    const { data: finalCost } = await supabase.rpc('get_user_cart_shipping_cost', {
      p_user_id: user.id,
      p_shipping_type_id: selectedTierId
    });
    
    // Verificar que el preview y el final coinciden (tolerancia de centavos)
    const difference = Math.abs(finalCost.total_cost_with_type - previewCost);
    if (difference > 0.10) {
      toast.warning('El costo de envío cambió. Por favor revisa tu carrito.');
      return;
    }
    
    // Proceder con checkout
    router.push('/checkout', { 
      shippingCost: finalCost.total_cost_with_type 
    });
  }

  return (
    <div>
      <h1>Carrito de Compras</h1>
      
      {/* Lista de items con controles de cantidad */}
      {cartItems.map(item => (
        <CartItem 
          key={item.id}
          item={item}
          onQuantityChange={(newQty) => {
            // Actualiza estado local (UI)
            setCartItems(prev => prev.map(i => 
              i.id === item.id ? {...i, quantity: newQty} : i
            ));
            // Preview se recalcula automáticamente (useEffect)
          }}
        />
      ))}
      
      {/* Selector de tipo de envío */}
      <ShippingTypeSelector 
        value={selectedTierId}
        onChange={setSelectedTierId}
      />
      
      {/* Preview del costo */}
      <div className="shipping-preview">
        <p>Costo de envío (estimado):</p>
        <h3>${previewCost.toFixed(2)} USD</h3>
        <small>El costo final se calculará en el checkout</small>
      </div>
      
      {/* Acciones */}
      <button onClick={handleSaveCart} disabled={isSaving}>
        Guardar Cambios
      </button>
      
      <button onClick={handleCheckout} className="primary">
        Proceder al Checkout
      </button>
    </div>
  );
}
```

---

## 🛡️ Validación en Backend

**IMPORTANTE:** Antes de procesar cualquier pago, el backend DEBE recalcular:

```sql
-- Función para crear orden con costo validado
CREATE OR REPLACE FUNCTION create_order_with_validated_shipping(
  p_user_id UUID,
  p_shipping_type_id UUID,
  p_frontend_shipping_cost NUMERIC  -- Lo que el frontend dice
)
RETURNS JSONB AS $$
DECLARE
  v_validated_cost JSONB;
  v_actual_cost NUMERIC;
BEGIN
  -- 1. Recalcular costo REAL desde DB
  SELECT get_user_cart_shipping_cost(p_user_id, p_shipping_type_id)
  INTO v_validated_cost;
  
  v_actual_cost := (v_validated_cost->>'total_cost_with_type')::numeric;
  
  -- 2. Verificar que coincide con lo que el frontend envió
  IF ABS(v_actual_cost - p_frontend_shipping_cost) > 0.10 THEN
    RAISE EXCEPTION 'Shipping cost mismatch: Expected %, got %', 
      v_actual_cost, p_frontend_shipping_cost;
  END IF;
  
  -- 3. Crear orden con costo validado
  INSERT INTO orders (
    user_id,
    shipping_cost,
    shipping_type_id,
    total_weight_kg,
    created_at
  ) VALUES (
    p_user_id,
    v_actual_cost,  -- Usar costo validado, NO el del frontend
    p_shipping_type_id,
    (v_validated_cost->>'total_weight_kg')::numeric,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'validated_cost', v_actual_cost,
    'order_id', lastval()
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 📋 Checklist de Implementación

### ✅ SQL (Backend)
- [x] Ejecutar `FIX_CALCULATE_SHIPPING_COST_CART_USE_TIERS.sql`
- [x] Ejecutar `FIX_GET_USER_CART_SHIPPING_COST_WITH_TIER_SELECTION.sql`
- [ ] Ejecutar `FIX_CALCULATE_CART_SHIPPING_COST_DYNAMIC_USE_TIERS.sql`
- [ ] Crear función de validación backend (create_order_with_validated_shipping)

### ✅ Frontend
- [ ] Implementar preview con `get_cart_shipping_cost()`
  - [ ] useEffect que recalcula cuando cambian items o tier
  - [ ] Mostrar costo estimado en UI
- [ ] Implementar checkout con `get_user_cart_shipping_cost()`
  - [ ] Guardar cambios antes de checkout
  - [ ] Recalcular costo final desde DB
  - [ ] Comparar preview vs final (alerta si difieren)
- [ ] Selector de tipo de envío (Express vs Standard)
- [ ] Manejo de errores y loading states

### ✅ Testing
- [ ] Test: Cambiar cantidad → preview actualiza
- [ ] Test: Cambiar tier → preview actualiza
- [ ] Test: Checkout → costo final coincide con DB
- [ ] Test: Checkout → backend rechaza si costos difieren
- [ ] Test: Express cuesta más que Standard

---

## 🎯 Resumen

| Acción | Función | Origen de Datos | Seguridad |
|--------|---------|-----------------|-----------|
| **Ver costo mientras edito** | `get_cart_shipping_cost()` | Frontend (estado local) | ⚠️ Preview (OK) |
| **Hacer checkout** | `get_user_cart_shipping_cost()` | DB (`b2b_cart_items`) | ✅ Validado |
| **Procesar pago (backend)** | `get_user_cart_shipping_cost()` | DB | ✅ Seguro |

**Regla de oro:**
- 👁️ **Preview** = `get_cart_shipping_cost()` - Rápido, flexible, temporal
- 💰 **Checkout/Pago** = `get_user_cart_shipping_cost()` - Seguro, validado, definitivo
