# Guía de Prueba: Integración de Logística con Envío

## ✅ Lo que se ha completado

### 1. **Base de Datos (Supabase)**
- ✅ 2 funciones RPC: `calculate_shipping_cost` y `calculate_shipping_cost_cart`
- ✅ Tabla `shipping_type_configs` con 3 tipos predefinidos:
  - STANDARD: $0 fijo, 0% extra
  - EXPRESS: $2 fijo, 0% extra
  - PRIORITY: $0 fijo, 10% extra
- ✅ 3 vistas SQL:
  - `v_business_panel_with_shipping_functions`: Panel con costos
  - `v_category_logistics`: Datos de logística para categorías
  - `v_business_panel_cart_summary`: Resumen de carrito

### 2. **React Hooks**
- ✅ `useShippingTypes`: Obtiene tipos de envío disponibles
- ✅ `useBusinessPanelDataWithShipping`: Datos del panel con costos
- ✅ `useCartShippingCost`: Calcula costos totales del carrito
- ✅ `useShippingCostCalculationForCart`: Cálculo alternativo

### 3. **Componentes React**
- ✅ `ShippingTypeSelector`: Selector de tipo de envío con UI
- ✅ Integración en `SellerCartPage`: Selector visible antes del checkout

---

## 🧪 Pasos de Prueba

### **Fase 1: Verificar que los datos se cargan correctamente**

1. Abre la aplicación como vendedor (seller)
2. Ve a tu carrito (CartPage)
3. **Verifica que aparezca la sección "Opciones de envío":**
   - Debe mostrar un selector con 3 opciones: STANDARD, EXPRESS, PRIORITY
   - Cada opción debe mostrar su costo/surcharge

#### **Expected Output:**
```
Opciones de envío
- STANDARD (sin surcharge)
- EXPRESS (+$2.00)
- PRIORITY (+10%)

Peso total: X kg
Costo base: $XX.XX
Total de envío: $XX.XX
```

---

### **Fase 2: Probar cálculo de costos con diferentes pesos**

#### **Caso A: Item ligero (0.4 kg)**

1. Agrega un producto con peso ~0.4 kg
2. Selecciona STANDARD
3. **Verifica el cálculo:**
   - Peso redondeado: 1 kg (CEIL(0.4) = 1)
   - Costo base: (1 × $3.50) + (1 × 2.20462 × $5.00) = $14.52
   - Total: $14.52

#### **Caso B: Item pesado (2.7 kg)**

1. Agrega un producto con peso ~2.7 kg
2. Selecciona STANDARD
3. **Verifica el cálculo:**
   - Peso redondeado: 3 kg (CEIL(2.7) = 3)
   - Costo base: (3 × $3.50) + (3 × 2.20462 × $5.00) = $43.56
   - Total: $43.56

#### **Caso C: Múltiples items**

1. Agrega:
   - Producto A: 0.5 kg (cantidad 2)
   - Producto B: 1.2 kg (cantidad 1)
2. Peso total SIN redondear: (0.5 × 2) + 1.2 = 2.2 kg
3. Peso redondeado: 3 kg (CEIL(2.2) = 3)
4. Selecciona STANDARD
5. **Verifica:**
   - Total peso: 3 kg
   - Total costo: $43.56

---

### **Fase 3: Probar surcharges de tipos de envío**

#### **Test 1: EXPRESS (surcharge $2 fijo)**

1. Usa los items del Caso C (peso redondeado: 3 kg)
2. Selecciona EXPRESS
3. **Verifica:**
   - Peso: 3 kg
   - Costo base: $43.56
   - Surcharge: +$2.00
   - **Total: $45.56**

#### **Test 2: PRIORITY (surcharge 10%)**

1. Usa los mismos items
2. Selecciona PRIORITY
3. **Verifica:**
   - Peso: 3 kg
   - Costo base: $43.56
   - Surcharge: +$4.36 (10% de $43.56)
   - **Total: $47.92**

#### **Test 3: Cambiar tipo sin modificar carrito**

1. Carrito activo con items
2. Cambiar de STANDARD → EXPRESS → PRIORITY
3. **Verifica:** Los costos se actualizan instantáneamente sin recargar

---

### **Fase 4: Validar integración en panel de negocio**

1. En el carrito, busca la sección "Ver Precios de Venta Sugeridos"
2. **Verifica que:**
   - Se muestre el costo de logística incluido
   - La ganancia neta sea correcta: `(PVP × cantidad) - (Costo B2B × cantidad) - (Envío × cantidad)`

---

### **Fase 5: Flujo de checkout**

1. Completa el carrito con múltiples items
2. Selecciona un tipo de envío
3. Click en "Comprar"
4. En CheckoutPage, **verifica que:**
   - El **costo de envío** aparezca en el resumen
   - El tipo de envío seleccionado se muestre
   - El cálculo de envío sea consistente con lo mostrado en el carrito

---

## 🔍 Checklist de Validación

### Funcionalidad de Cálculos
- [ ] Peso se redondea hacia arriba (CEIL)
- [ ] Fórmula de costo base es correcta: `(peso_kg × tramo_a) + (peso_kg × 2.20462 × tramo_b)`
- [ ] Surcharge STANDARD: +$0
- [ ] Surcharge EXPRESS: +$2 fijo
- [ ] Surcharge PRIORITY: +10% del costo base
- [ ] Cambiar tipo de envío recalcula instantáneamente

### UI/UX
- [ ] Selector de tipo de envío visible en carrito
- [ ] Tres opciones disponibles (STANDARD, EXPRESS, PRIORITY)
- [ ] Precios mostrados claramente
- [ ] Información de peso visible
- [ ] Errores se muestran claramente si existen

### Integración
- [ ] ShippingTypeSelector integrado en SellerCartPage
- [ ] CartItems se preparan correctamente
- [ ] Estados se actualizan al cambiar tipo
- [ ] Datos se pasan correctamente a componentes hijo

### Performance
- [ ] No hay múltiples llamadas innecesarias a la BD
- [ ] Cambios de tipo de envío son rápidos (<500ms)
- [ ] UI no se congela

---

## 📊 Datos de Prueba Recomendados

### Ruta por defecto
- **ID**: `21420dcb-9d8a-4947-8530-aaf3519c9047`
- **Ruta**: China → Haití
- **Tramo A (China→Transit)**: $3.50/kg
- **Tramo B (Transit→Destination)**: $5.00/kg

### Productos de prueba
| Peso | Escenario | Notas |
|------|-----------|-------|
| 0.3 kg | Muy ligero | CEIL = 1 kg |
| 0.7 kg | Ligero | CEIL = 1 kg |
| 1.5 kg | Medio | CEIL = 2 kg |
| 2.8 kg | Pesado | CEIL = 3 kg |
| 5.2 kg | Muy pesado | CEIL = 6 kg |

### Carrito de prueba
```
Item 1: 0.5 kg × 2 unidades = 1 kg
Item 2: 0.8 kg × 1 unidad = 0.8 kg
Total sin redondear = 1.8 kg
Total redondeado = 2 kg
```

---

## 🚀 Próximos Pasos (No incluidos en esta fase)

1. **CategoryProductsPage**: Mostrar costo de envío en el listing de categoría
2. **CheckoutPage**: Resumen final con desglose de costos
3. **Admin Panel**: Visualizar logs de cálculos de envío
4. **Performance**: Optimizar queries para lotes grandes de items
5. **Multi-ruta**: Soportar envíos a diferentes destinos

---

## ⚠️ Problemas Comunes

### Problema: "Shipping type not found"
**Causa**: La tabla `shipping_type_configs` está vacía
**Solución**: Ejecutar PARTE 4 de la migración nuevamente

### Problema: "Route not found"
**Causa**: La ruta China→Haití no existe en `shipping_routes`
**Solución**: Verificar que la ruta existe con ID `21420dcb-9d8a-4947-8530-aaf3519c9047`

### Problema: Costos incorrectos
**Causa**: Pesos no están siendo cargados correctamente
**Solución**: Verificar que los productos tienen `peso_kg` o `peso_g` en DB

### Problema: Selector no aparece
**Causa**: `someSelected` es false
**Solución**: Agregar al menos 1 item al carrito

---

## 📝 Notas

- Los costos de envío **YA ESTÁN INCLUIDOS** en el PVP sugerido del BusinessPanel
- El redondeo de peso es **hacia arriba** (CEIL), no promedio
- Los tipos de envío son **por ruta**, pueden variar según destino
- Los surcharges son **acumulativos**: fijo + porcentaje
