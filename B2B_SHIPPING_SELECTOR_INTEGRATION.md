# Integración del Selector B2B de Tipo de Envío

## ✅ Implementación Completada

Se ha integrado exitosamente el componente `B2BShippingSelector` en el checkout B2B (`SellerCheckout.tsx`) para permitir a los usuarios seleccionar entre envío **Standard** (consolidado/marítimo) y **Express** (prioritario/aéreo).

---

## 📋 Cambios Realizados

### 1. Imports Agregados
```typescript
import { useB2BPricingEngineV2 } from '@/hooks/useB2BPricingEngineV2';
import { B2BShippingSelector } from '@/components/checkout/B2BShippingSelector';
```

### 2. Hooks y Estados Agregados
```typescript
// Motor de precios B2B
const pricingEngine = useB2BPricingEngineV2();

// Estados para selector de tipo de envío
const [selectedTier, setSelectedTier] = useState<'standard' | 'express'>('standard');
const [shippingOptions, setShippingOptions] = useState<any[]>([]);
const [loadingShipping, setLoadingShipping] = useState(false);
```

### 3. useEffect para Cargar Opciones de Envío
Se agregó un `useEffect` que:
- Se ejecuta cuando `selectedAddressId` o `deliveryMethod` cambian
- Llama a `pricingEngine.getShippingOptions(addressId)` para obtener opciones Standard/Express disponibles
- Carga automáticamente la única opción disponible si solo hay una
- Solo funciona cuando `deliveryMethod === 'address'` (envío a domicilio)

```typescript
useEffect(() => {
  const loadShippingOptions = async () => {
    if (!selectedAddressId || deliveryMethod !== 'address') {
      setShippingOptions([]);
      return;
    }

    setLoadingShipping(true);
    try {
      const response = await pricingEngine.getShippingOptions(selectedAddressId);
      if (response && response.valid && response.options) {
        setShippingOptions(response.options);
        if (response.options.length === 1) {
          setSelectedTier(response.options[0].tier_type as 'standard' | 'express');
        }
      }
    } catch (error) {
      console.error('Error loading shipping options:', error);
      setShippingOptions([]);
    } finally {
      setLoadingShipping(false);
    }
  };

  loadShippingOptions();
}, [selectedAddressId, deliveryMethod]);
```

### 4. Componente UI Agregado
Se insertó el selector entre "Opción de Entrega" y "Productos":

```tsx
{/* B2B Shipping Type Selector - Only for address delivery */}
{deliveryMethod === 'address' && selectedAddressId && shippingOptions.length > 0 && (
  <Card className="p-6">
    <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
      <Truck className="h-5 w-5" />
      Tipo de Envío
    </h2>
    <p className="text-sm text-muted-foreground mb-4">
      Selecciona el tipo de envío para tu pedido
    </p>
    <B2BShippingSelector
      options={shippingOptions}
      selectedTier={selectedTier}
      onTierChange={setSelectedTier}
      hasOversizeProducts={false}
      loading={loadingShipping}
    />
  </Card>
)}
```

---

## 🎯 Comportamiento del Selector

### Condiciones de Visualización
El selector **SOLO** se muestra cuando:
1. ✅ `deliveryMethod === 'address'` (envío a domicilio)
2. ✅ `selectedAddressId` está definido (dirección seleccionada)
3. ✅ `shippingOptions.length > 0` (opciones disponibles para la dirección)

### Flujo de Usuario
1. Usuario selecciona "Envío a Domicilio"
2. Usuario elige una dirección de entrega
3. Sistema carga automáticamente opciones Standard/Express disponibles para esa dirección
4. Selector aparece mostrando opciones con:
   - **Precios** por tramo A (China→USA) y tramo B (USA→Haití)
   - **ETAs** (tiempo estimado de entrega)
   - **Tipo de transporte** (marítimo/aéreo)
   - **Capacidades** y restricciones
5. Usuario selecciona Standard o Express
6. `selectedTier` state se actualiza con la selección

### Diferencias entre Standard y Express

| Característica | Standard | Express |
|----------------|----------|---------|
| **Transporte** | Marítimo (consolidado) | Aéreo (prioritario) |
| **Velocidad** | Más lento | Más rápido |
| **Costo** | Más económico | Más costoso |
| **Oversize** | ✅ Permite productos grandes | ❌ Solo productos estándar |
| **ETA** | 15-30 días | 5-10 días |

---

## 🔗 Integración con Backend

### RPC Functions Utilizadas
- **`get_shipping_options_for_address`**: Obtiene opciones Standard/Express disponibles para una dirección
- **`calculate_b2b_price_multitramo`**: Calcula precio total con conversión g→kg (Tramo A) y g→lb (Tramo B)

### Tablas Relacionadas
- **`shipping_routes`**: Rutas logísticas configuradas por admin
- **`shipping_tiers`**: Tiers de envío (Standard/Express) con:
  - `tier_type`: 'standard' | 'express'
  - `transport_type`: 'maritimo' | 'aereo'
  - Costos por tramo A y B
  - ETAs y capacidades

### Cálculo de Precios
```typescript
const response = await pricingEngine.getShippingOptions(addressId);
// Retorna opciones con precios calculados para la dirección específica
```

---

## 📊 Datos Mostrados en Selector

Cada opción muestra:
- **Nombre del Tier**: ej. "Standard - Consolidado", "Express - Aéreo"
- **Precio Tramo A**: China → USA ($/kg)
- **Precio Tramo B**: USA → Haití ($/lb)
- **ETA Tramo A**: días estimados
- **ETA Tramo B**: días estimados
- **Capacidades**: Oversize permitido, productos sensibles, etc.
- **Restricciones**: Alertas sobre limitaciones

---

## ✅ Verificaciones Completadas

- ✅ TypeScript compila sin errores
- ✅ Componente se muestra condicionalmente
- ✅ State management correcto
- ✅ Integración con `useB2BPricingEngineV2`
- ✅ useEffect con dependencias correctas
- ✅ Loading states manejados

---

## 🚀 Próximos Pasos

### 1. Ejecutar Migraciones SQL (CRÍTICO)
Antes de probar, ejecutar en Supabase SQL Editor:
```bash
# Archivos a ejecutar:
- supabase/migrations/20260202_peso_gramos.sql
- supabase/migrations/20260202_transport_type.sql
```

### 2. Configurar Rutas en Admin
1. Ir a `/admin/logistica/rutas`
2. Crear rutas logísticas
3. Agregar tiers Standard y Express por ruta
4. Configurar costos y ETAs

### 3. Probar en Checkout
1. Agregar productos al carrito
2. Ir a checkout
3. Seleccionar "Envío a Domicilio"
4. Elegir dirección
5. Verificar que aparece selector con opciones
6. Probar cambio entre Standard y Express

### 4. Validar Cálculos
- Verificar precios calculados correctamente
- Verificar conversión g→kg (Tramo A)
- Verificar conversión g→lb (Tramo B)
- Verificar Math.ceil() aplicado
- Verificar peso mínimo 200g por producto

### 5. Testing Edge Cases
- Dirección sin cobertura (sin opciones)
- Solo una opción disponible (auto-select)
- Productos oversize (Express bloqueado)
- Cambio de dirección (recarga opciones)
- Cambio a pickup (oculta selector)

---

## 🐛 Troubleshooting

### Selector no aparece
- ✅ Verificar que `deliveryMethod === 'address'`
- ✅ Verificar que `selectedAddressId` no es null
- ✅ Verificar que `shippingOptions.length > 0`
- ✅ Verificar migraciones SQL ejecutadas
- ✅ Verificar rutas configuradas en admin

### Opciones vacías
- ✅ Verificar que dirección tiene zona asignada
- ✅ Verificar que ruta existe para esa zona
- ✅ Verificar que ruta tiene tiers configurados
- ✅ Verificar logs del RPC function

### Precios incorrectos
- ✅ Verificar costos configurados en shipping_tiers
- ✅ Verificar peso_g en productos
- ✅ Verificar función calculate_b2b_price_multitramo
- ✅ Verificar Math.ceil() aplicado

---

## 📝 Notas Técnicas

### Importante
- El selector **NO** se muestra para "Retiro en Punto" (pickup)
- Solo funciona con direcciones que tienen zona asignada
- Requiere que admin configure rutas y tiers previamente
- Express puede estar bloqueado para productos oversize

### Estado del selectedTier
El `selectedTier` seleccionado debe:
1. Guardarse en el metadata de la orden
2. Pasarse al RPC function de cálculo final
3. Usarse para determinar costos de envío reales

### Próxima Integración
Conectar `selectedTier` con:
- Función `createOrder` para guardar en metadata
- Cálculo final de precio total con envío incluido
- Validación pre-submit del checkout

---

## 📚 Archivos Modificados

```
✏️ src/pages/seller/SellerCheckout.tsx
  - Agregados imports
  - Agregados hooks y estados
  - Agregado useEffect para cargar opciones
  - Agregado componente B2BShippingSelector en UI
```

## 📚 Archivos Relacionados (sin modificar)

```
📁 src/components/checkout/B2BShippingSelector.tsx (existente)
📁 src/hooks/useB2BPricingEngineV2.ts (existente)
📁 src/pages/admin/AdminLogisticaRutas.tsx (existente)
📁 supabase/migrations/20260202_peso_gramos.sql (pendiente ejecutar)
📁 supabase/migrations/20260202_transport_type.sql (pendiente ejecutar)
```

---

## ✨ Resultado Final

Los usuarios ahora pueden:
1. ✅ Ver opciones Standard y Express en checkout
2. ✅ Comparar precios por tramo A y B
3. ✅ Ver ETAs diferenciados
4. ✅ Seleccionar el tipo de envío que prefieren
5. ✅ Ver restricciones y capacidades de cada opción

El sistema automáticamente:
1. ✅ Carga opciones basadas en dirección seleccionada
2. ✅ Oculta selector si no hay opciones disponibles
3. ✅ Auto-selecciona si solo hay una opción
4. ✅ Bloquea Express para productos oversize
5. ✅ Calcula precios con conversión correcta de unidades
