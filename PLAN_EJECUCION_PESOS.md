# 📋 Plan de Ejecución: Sistema Automático de Pesos

## Problema Identificado
❌ Checkbox de costo de envío muestra $0.00 porque variantes no tienen peso configurado

## Solución Completa

### 1️⃣ PASO 1: Activar Trigger (Para futuro)
**Archivo:** `TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql`

**Qué hace:**
- Crea trigger que automáticamente copia peso del producto a variantes nuevas
- Se ejecuta automáticamente al crear/actualizar variantes
- Solo copia si la variante NO tiene peso propio

**Ejecutar primero:** ✅ Sí, ejecutar en Supabase SQL Editor

```sql
-- Comportamiento automático:
-- Nueva variante sin peso → Copia peso del producto
-- Nueva variante con peso → Respeta peso propio
-- Actualizar variante a NULL → Copia peso del producto
```

---

### 2️⃣ PASO 2: Arreglar Variantes Existentes (Para ahora)
**Archivo:** `ACTUALIZAR_TODAS_VARIANTES_SIN_PESO.sql`

**Qué hace:**
- Actualiza TODAS las variantes existentes sin peso
- Copia peso de producto base solo si variante no tiene peso
- Incluye análisis pre y post actualización

**Ejecutar segundo:** ✅ Sí, ejecutar en Supabase SQL Editor

```sql
-- Afecta a:
-- - Todas las variantes con peso_kg = NULL AND peso_g = NULL
-- - Respeta variantes que ya tienen peso propio
```

---

## Verificación

Después de ejecutar ambos scripts:

### ✅ Verificar Frontend
1. Ir a `/seller/carrito`
2. Checkbox debería mostrar costo > $0.00
3. Total estimado debe incluir costo de envío al seleccionar

### ✅ Verificar Base de Datos
```sql
-- Test 1: Ver variantes actualizadas
SELECT 
  COUNT(*) as variantes_con_peso
FROM product_variants 
WHERE peso_kg IS NOT NULL OR peso_g IS NOT NULL;

-- Test 2: Ver vista de shipping
SELECT * FROM v_cart_shipping_costs;
-- Debe retornar: total_cost_with_type > 0

-- Test 3: Crear nueva variante de prueba
INSERT INTO product_variants (id, product_id, name, sku)
VALUES (
  gen_random_uuid(),
  '3f61c5dc-ed1c-491a-894e-44ae6d1e380c',
  'Test Variante',
  'TEST-001'
);

-- Verificar que tiene peso automáticamente
SELECT peso_kg FROM product_variants WHERE sku = 'TEST-001';
-- Debe retornar: 0.3 (peso copiado del producto)
```

---

## 🎯 Resultados Esperados

### Antes (Problema)
```
Producto: peso_kg = 0.3 ✅
Variante 1: peso_kg = NULL ❌
Variante 2: peso_kg = NULL ❌
→ total_weight_kg = 0
→ shipping_cost = $0.00
```

### Después (Solucionado)
```
Producto: peso_kg = 0.3 ✅
Variante 1: peso_kg = 0.3 ✅ (copiado automáticamente)
Variante 2: peso_kg = 0.3 ✅ (copiado automáticamente)
→ total_weight_kg = 0.6
→ shipping_cost = $11.05 (2 items × 0.3 kg = 0.6 kg → 1 kg redondeado)
```

---

## 📝 Orden de Ejecución

1. ✅ **TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql** (Primero)
   - Tiempo: ~5 segundos
   - Crea función y trigger
   - Ejecuta tests automáticos
   
2. ✅ **ACTUALIZAR_TODAS_VARIANTES_SIN_PESO.sql** (Segundo)
   - Tiempo: ~10-30 segundos (depende de cantidad de variantes)
   - Actualiza variantes existentes
   - Muestra reporte de cambios

3. 🔄 **Refresh Frontend**
   - Recargar página `/seller/carrito`
   - Verificar checkbox muestra costo correcto

---

## 🛡️ Casos de Uso

### Caso 1: Nueva variante sin especificar peso
```sql
INSERT INTO product_variants (product_id, name, sku)
VALUES ('producto-uuid', 'Talla M', 'SKU-M');
-- Resultado: peso_kg copiado del producto automáticamente ✅
```

### Caso 2: Nueva variante con peso específico
```sql
INSERT INTO product_variants (product_id, name, sku, peso_kg)
VALUES ('producto-uuid', 'Talla XL', 'SKU-XL', 0.5);
-- Resultado: peso_kg = 0.5 (respetado) ✅
```

### Caso 3: Actualizar variante quitando peso
```sql
UPDATE product_variants 
SET peso_kg = NULL, peso_g = NULL 
WHERE id = 'variante-uuid';
-- Resultado: peso_kg copiado del producto automáticamente ✅
```

### Caso 4: Actualizar variante con peso propio
```sql
UPDATE product_variants 
SET peso_kg = 0.8 
WHERE id = 'variante-uuid';
-- Resultado: peso_kg = 0.8 (respetado) ✅
```

---

## ✨ Beneficios

✅ **Automático:** No más scripts manuales para nuevas variantes  
✅ **Consistente:** Todas las variantes tendrán peso válido  
✅ **Flexible:** Respeta pesos específicos de variantes  
✅ **Transparente:** Funciona en segundo plano sin intervención  
✅ **Retroactivo:** Actualización única arregla historial  

---

## 🚀 Próximos Pasos

1. Ejecutar `TRIGGER_AUTO_COPIAR_PESO_VARIANTES.sql` en Supabase
2. Ejecutar `ACTUALIZAR_TODAS_VARIANTES_SIN_PESO.sql` en Supabase
3. Verificar checkbox en frontend `/seller/carrito`
4. Confirmar costo de envío > $0.00
5. ✅ **Done!** Sistema funcionando automáticamente

---

## 📊 Impacto

- **Variantes afectadas (una vez):** Todas las existentes sin peso
- **Variantes futuras:** 100% automático
- **Mantenimiento requerido:** 0 (trigger se encarga)
- **Intervención manual:** Solo si se desea peso diferente al producto base
