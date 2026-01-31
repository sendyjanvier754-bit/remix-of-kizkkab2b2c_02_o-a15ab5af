# ⚡ QUICK START: Motores Separados en 10 Minutos

**Objetivo:** Usar los motores separados en tu componente  
**Tiempo:** 10 minutos  
**Nivel:** Intermedio

---

## 1️⃣ Aplicar Migración SQL (3 min)

```bash
# Opción A: Supabase Dashboard (MÁS FÁCIL)
1. Ir a: https://app.supabase.com/project/fonvunyiaxcjkodrnpox/sql/new
2. Copiar TODO el contenido de:
   supabase/migrations/20260131_separate_pricing_logistics.sql
3. Pegar en la ventana SQL
4. Clic en "Run"
5. ✅ Verás "Query succeeded" sin errores
```

---

## 2️⃣ Usar Motor de Precio (2 min)

```typescript
// En tu componente ProductCard.tsx
import { useB2BPricingEngine } from '@/hooks/useB2BPricingEngine';

export function ProductCard({ product }) {
  const { getProductBasePrice, formatPrice } = useB2BPricingEngine();
  
  // Obtener precio base (sin logística)
  const basePrice = product.precio_base;
  
  return (
    <div className="product-card">
      <h2>{product.nombre}</h2>
      <p className="price">{formatPrice(basePrice, 'USD')}</p>
      {/* Resto del componente */}
    </div>
  );
}
```

---

## 3️⃣ Usar Motor de Logística (2 min)

```typescript
// En tu componente RouteSelector.tsx
import { useLogisticsEngine } from '@/hooks/useLogisticsEngineSeparated';

export function RouteSelector() {
  const { routes, calculateLogisticsCost, getEstimatedDays } = 
    useLogisticsEngine();
  
  const handleSelectRoute = async (routeId) => {
    // Calcular costo de envío
    const logistics = await calculateLogisticsCost(routeId, 5); // 5kg
    
    console.log('Costo total:', logistics.total_cost);
    console.log('Tramo A (China→Hub):', logistics.tramo_a_china_to_hub);
    console.log('Tramo B (Hub→Destino):', logistics.tramo_b_hub_to_destination);
    
    // Obtener tiempo estimado
    const days = getEstimatedDays(routeId);
    console.log(`Entrega en ${days?.min}-${days?.max} días`);
  };
  
  return (
    <div>
      {routes.map(route => (
        <button key={route.route_id} onClick={() => handleSelectRoute(route.route_id)}>
          {route.destination_country_name}
        </button>
      ))}
    </div>
  );
}
```

---

## 4️⃣ Unificar en Checkout (3 min)

```typescript
// En tu componente CheckoutPage.tsx
import { useCheckoutCalculator } from '@/hooks/useCheckoutCalculator';

export function CheckoutPage() {
  const checkout = useCheckoutCalculator();
  const [summary, setSummary] = useState(null);
  
  // Agregar un producto al checkout
  const handleAddProduct = async (product, quantity) => {
    checkout.addToCheckout(product, quantity, 'route-456');
  };
  
  // Calcular total
  const handleCalculateTotal = async () => {
    const total = await checkout.calculateCheckoutTotal(
      checkout.checkoutItems
    );
    setSummary(total);
  };
  
  return (
    <div>
      {/* Items */}
      {checkout.checkoutItems.map(item => (
        <div key={item.product.product_id}>
          <span>{item.product.nombre}</span>
          <span>${item.priceBase.toFixed(2)}</span>
          <span>${item.logisticsCost.toFixed(2)}</span>
        </div>
      ))}
      
      {/* Total */}
      {summary && (
        <div className="total">
          <p>Precio: ${summary.subtotalPrice.toFixed(2)}</p>
          <p>Envío: ${summary.logisticsCost.toFixed(2)}</p>
          <p>Fee: ${summary.platformFee.toFixed(2)}</p>
          <p>Impuestos: ${summary.tax.toFixed(2)}</p>
          <h2>TOTAL: ${summary.total.toFixed(2)}</h2>
        </div>
      )}
      
      <button onClick={handleCalculateTotal}>
        Calcular Total
      </button>
    </div>
  );
}
```

---

## ✅ Verificar que Funcione

```bash
# 1. Verificar que no haya errores de compilación
npm run type-check

# 2. Verificar que los hooks se importan
npm run build

# 3. Ejecutar en desarrollo
npm run dev

# 4. Abrir tu componente y verificar que muestre precios
# Debería ver algo como: $145.60
```

---

## 🔍 Debugging

### Error: "v_productos_precio_base no existe"
```sql
-- Verificar en Supabase SQL Editor:
SELECT * FROM v_productos_precio_base LIMIT 1;

-- Si no existe, significa que la migración NO se aplicó
-- Intenta de nuevo desde el Dashboard
```

### Error: "calculate_base_price_only no existe"
```sql
-- Verificar en Supabase SQL Editor:
SELECT calculate_base_price_only('prod-123'::uuid, 30);

-- Si falla, la migración tiene errores
-- Copia el SQL completo y ejecuta nuevamente
```

### Error: "Hook no se importa"
```typescript
// Asegúrate que la ruta es correcta:
import { useB2BPricingEngine } from '@/hooks/useB2BPricingEngine';
                                           // ^-- El archivo debe existir
```

---

## 📊 Fórmulas de Referencia

```
PRECIO BASE:
  = costo_fabrica + margen + fee_plataforma
  = 100 + (100 × 0.30) + (130 × 0.12)
  = 100 + 30 + 15.60
  = 145.60

COSTO LOGÍSTICA:
  = costo_china_to_hub + costo_hub_to_destination
  = (5kg × $10/kg) + (5kg × $8/kg)
  = 50 + 40
  = 90

CHECKOUT TOTAL:
  = (precio_base × cantidad) + logística + fee_plataforma + impuestos
  = (145.60 × 2) + 90 + ((291.20 + 90) × 0.12) + impuestos
  = 291.20 + 90 + 45.74 + impuestos
  = 426.94 + impuestos
```

---

## 🎯 Casos de Uso Comunes

### 1. Mostrar precio en PDP
```typescript
const { getProductBasePrice } = useB2BPricingEngine();
const product = await getProductBasePrice('prod-123');
console.log(product.precio_base);  // $145.60
```

### 2. Filtrar productos por precio
```typescript
const { productsWithBasePrice } = useB2BPricingEngine();
const affordable = productsWithBasePrice.filter(p => p.precio_base < 200);
```

### 3. Obtener rutas de envío
```typescript
const { getRoutesByCountry } = useLogisticsEngine();
const routesHaiti = getRoutesByCountry('HT');
```

### 4. Ruta más barata
```typescript
const { getLowestCostRoute } = useLogisticsEngine();
const cheapest = getLowestCostRoute(routeIds, 5); // 5kg
```

### 5. Calcular total de orden
```typescript
const { calculateCheckoutTotal } = useCheckoutCalculator();
const summary = await calculateCheckoutTotal(checkoutItems);
console.log(summary.total);  // $538.26
```

---

## 🚀 Próximos Pasos

Una vez que funcione:

1. ✅ Integra en ProductCard.tsx
2. ✅ Integra en CartItem.tsx
3. ✅ Integra en CheckoutPage.tsx completa
4. ✅ Ejecuta tests: `npm test motors.test.ts`
5. ✅ Deploy a staging
6. ✅ QA y validación
7. ✅ Deploy a producción

---

## 💬 Tips Importantes

- 🎯 **Motor de Precio:** Úsalo en PDP, Catálogo, Admin - es rápido
- 🚚 **Motor de Logística:** Úsalo cuando el usuario selecciona ruta
- 📦 **Checkout:** Usa ambos juntos aquí - es donde se unifican
- 🧪 **Testing:** Cada motor se testa aislado - más fácil
- 📊 **Debugging:** Si hay error, saber si es en precio o logística

---

**¡Listo! Ahora tienes motores separados funcionando.** 🎉

Para más detalles, ver:
- `ARQUITECTURA_MOTORES_SEPARADOS.md` - Guía completa
- `CheckoutPageExample.tsx` - Componente funcional
