# ⚡ Quick Reference: Testing de Logística

## 🔗 SQL Queries para Validar

### Test 1: Función de costo individual
```sql
-- Probar con 0.4 kg
SELECT * FROM public.calculate_shipping_cost(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.400
);
-- Expected: weight_kg=0.4, base_cost=14.52
```

### Test 2: Función de carrito SIN surcharge
```sql
-- Probar con 0.7 kg total sin tipo de envío
SELECT * FROM public.calculate_shipping_cost_cart(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  0.700,
  NULL
);
-- Expected: weight_rounded_kg=1, base_cost=14.52, extra_cost=0, total=14.52
```

### Test 3: Carrito CON EXPRESS (+$2)
```sql
-- Obtener UUID del tipo EXPRESS
SELECT id FROM public.shipping_type_configs 
WHERE type = 'EXPRESS' AND is_active = true LIMIT 1;

-- Luego usar ese UUID:
SELECT * FROM public.calculate_shipping_cost_cart(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  1.800,
  'UUID_EXPRESS'
);
-- Expected: total ≈ $31.04 (base $29.04 + $2.00)
```

### Test 4: Carrito CON PRIORITY (+10%)
```sql
SELECT id FROM public.shipping_type_configs 
WHERE type = 'PRIORITY' AND is_active = true LIMIT 1;

SELECT * FROM public.calculate_shipping_cost_cart(
  '21420dcb-9d8a-4947-8530-aaf3519c9047',
  1.800,
  'UUID_PRIORITY'
);
-- Expected: extra_cost ≈ $2.90, total ≈ $31.94
```

### Test 5: Listar tipos de envío
```sql
SELECT 
  id, 
  type, 
  display_name, 
  extra_cost_fixed, 
  extra_cost_percent,
  is_active
FROM public.shipping_type_configs
WHERE shipping_route_id = '21420dcb-9d8a-4947-8530-aaf3519c9047'
ORDER BY priority_order;
```

### Test 6: Validar vistas existen
```sql
SELECT table_name 
FROM information_schema.tables
WHERE table_type = 'VIEW'
AND table_name IN (
  'v_business_panel_with_shipping_functions',
  'v_category_logistics',
  'v_business_panel_cart_summary'
);
```

---

## 🧮 Cálculos Esperados

### Fórmula
```
base_cost = (peso_kg × 3.50) + (peso_kg × 2.20462 × 5.00)
          = peso_kg × (3.50 + 11.0231)
          = peso_kg × 14.5231
```

### Tabla de Referencia
| Peso (kg) | Redondeado | Base Cost | EXPRESS | PRIORITY |
|-----------|-----------|-----------|---------|----------|
| 0.4 | 1 | $14.52 | $16.52 | $15.97 |
| 0.7 | 1 | $14.52 | $16.52 | $15.97 |
| 1.0 | 1 | $14.52 | $16.52 | $15.97 |
| 1.5 | 2 | $29.04 | $31.04 | $31.94 |
| 1.8 | 2 | $29.04 | $31.04 | $31.94 |
| 2.5 | 3 | $43.57 | $45.57 | $47.92 |
| 3.0 | 3 | $43.57 | $45.57 | $47.92 |

---

## 🖥️ Dónde Probar en la UI

### React Component Testing

#### 1. SellerCartPage - Carrito
```
En: /seller/cart
Zona: Antes de "Payment Methods"
Que ver:
- Selector dropdown con 3 tipos
- Peso total mostrado
- Costo base y surcharge separados
- Total de envío destacado
```

#### 2. Cambiar tipo de envío sin recargar
```
Paso 1: Seleccionar STANDARD
Paso 2: Cambiar a EXPRESS
Paso 3: Cambiar a PRIORITY
Resultado: Costos se actualizan instantáneamente
```

#### 3. Agregar/quitar items
```
Paso 1: Carrito con 1 item
Paso 2: Agregar otro item
Resultado: Peso y costos se recalculan automáticamente
Paso 3: Quitar item
Resultado: Vuelve a recalcular
```

---

## 🐛 Debug Mode

### Verificar que hooks están funcionando

```typescript
// En consola del navegador
// Si tienes acceso al estado de React

// Ver los tipos cargados:
console.log('Shipping types:', shippingTypes);

// Ver el resumen de costos:
console.log('Shipping summary:', summary);

// Ver items del carrito:
console.log('Cart items:', cartItemsForShipping);
```

### Verificar que las queries funcionan

En Supabase:
1. Ve a SQL Editor
2. Ejecuta cualquiera de los queries de arriba
3. Verifica que no haya errores
4. Compara resultados con tabla de referencia

---

## 🔧 Troubleshooting Rápido

| Síntoma | Verificar |
|---------|-----------|
| Selector no aparece | ¿Tiene items en carrito? |
| Costos incorrectos | ¿Tiene peso el producto? |
| Dropdown vacío | ¿Existen tipos en BD? |
| Error en consola | ¿UUIDs correctos? |
| Loading lento | ¿Pesa mucho la query? |

---

## 📋 Checklist de Validación

```
Base de Datos:
[ ] Funciones RPC existen
[ ] Tabla shipping_type_configs tiene 3 tipos
[ ] Vistas se pueden consultar
[ ] Sin errores en queries

React:
[ ] ShippingTypeSelector importa sin errores
[ ] SellerCartPage compila sin problemas
[ ] Hooks ejecutan sin crashes
[ ] Estados se actualizan correctamente

Testing:
[ ] SQL queries devuelven datos
[ ] Cálculos coinciden con fórmula
[ ] UI muestra valores correctos
[ ] Cambios se reflejan instantáneamente
```

---

## 🎯 Próximos Pasos

1. [ ] Ejecutar SQL queries de prueba
2. [ ] Agregar items al carrito
3. [ ] Validar que aparezca ShippingTypeSelector
4. [ ] Comparar costos con tabla de referencia
5. [ ] Cambiar tipos de envío y validar cálculos
6. [ ] Completar guía de pruebas completa

---

**Última actualización**: 2026-02-10
**Versión**: 1.0 - Quick Reference
