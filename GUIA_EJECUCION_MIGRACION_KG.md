# 🚀 GUÍA DE EJECUCIÓN: Migración a Sistema KG-Only

## ✅ Cambios Implementados

### 1. SQL: Migración Completa ([MIGRACION_KG_COMPLETA_CON_SEGMENTOS.sql](./MIGRACION_KG_COMPLETA_CON_SEGMENTOS.sql))

**Qué hace:**
- ✅ Agrega columna `tramo_b_cost_per_kg` (fuente de verdad)
- ✅ **Sincroniza con `route_logistics_costs`** (no solo convierte de lb)
- ✅ Actualiza `calculate_shipping_cost_cart` para usar solo kg
- ✅ Crea trigger automático para mantener kg ↔ lb sincronizados
- ✅ Fallback: Si `tramo_b_cost_per_kg` es NULL, convierte desde lb

**Ventajas:**
- No rompe nada existente
- Botón "Cargar desde Segmentos" funcionará correctamente
- Sincronización automática entre kg y lb

---

### 2. TypeScript: Admin Panel Actualizado

#### Archivos Modificados:

**a) [src/types/b2b-shipping.ts](./src/types/b2b-shipping.ts)**
```typescript
export interface ShippingTier {
  // ...
  tramo_b_cost_per_kg: number;  // ✅ NUEVO - Fuente de verdad
  tramo_b_cost_per_lb: number;  // Para display en UI
  // ...
}
```

**b) [src/pages/admin/AdminGlobalLogisticsPage.tsx](./src/pages/admin/AdminGlobalLogisticsPage.tsx)**

**Cambios:**
1. ✅ Tipo `ShippingTier` actualizado con `tramo_b_cost_per_kg`
2. ✅ Estado `tierForm` ahora incluye ambas columnas:
   ```typescript
   tramo_b_cost_per_kg: 5.0,      // Fuente de verdad
   tramo_b_cost_per_lb: 11.0231,  // Auto-calculado
   ```

3. ✅ Función `loadCostsFromSegments` actualizada para cargar **AMBAS**:
   ```typescript
   tramo_b_cost_per_kg: tramoB.cost_per_kg,           // ✅ NUEVO
   tramo_b_cost_per_lb: tramoB.cost_per_kg * 2.20462, // Sincronizado
   ```

4. ✅ UI con **2 campos sincronizados**:
   - **Costo por kg (USD)** - Campo principal (fuente de verdad)
   - **Costo por lb (USD)** - Auto-calculado (verde, sincronizado)
   - Editar cualquiera de los dos actualiza el otro automáticamente

---

## 📋 Pasos para Ejecutar

### PASO 1: Ejecutar Migración SQL

**En Supabase SQL Editor:**

```sql
-- Copiar y pegar TODO el contenido de MIGRACION_KG_COMPLETA_CON_SEGMENTOS.sql
```

**Qué esperar:**
- ✅ Columna `tramo_b_cost_per_kg` agregada
- ✅ Valores sincronizados desde `route_logistics_costs`
- ✅ Tabla de verificación mostrando:
  ```
  Tier              | Segmento B ($/kg) | Tier B ($/kg) | Match B
  Express Aéreo     | 5.00              | 5.00          | ✅
  Marítimo Estándar | 3.00              | 3.00          | ✅
  ```
- ✅ Prueba de cálculo para 2kg:
  ```
  Express: $24.00 ✅ (antes $62.60)
  Marítimo: $10.60 ✅ (antes $33.76)
  ```

---

### PASO 2: Verificar Trigger de Sincronización

El trigger `sync_tramo_b_cost_columns()` mantiene automáticamente sincronizados kg y lb:

**Prueba manual:**
```sql
-- Actualizar solo kg
UPDATE shipping_tiers 
SET tramo_b_cost_per_kg = 6.0 
WHERE tier_name = 'Express Aéreo';

-- Verificar que lb se actualizó automáticamente
SELECT 
  tier_name,
  tramo_b_cost_per_kg as "kg",
  tramo_b_cost_per_lb as "lb",
  ROUND(tramo_b_cost_per_kg * 2.20462, 4) as "lb esperado",
  CASE 
    WHEN ABS(tramo_b_cost_per_lb - (tramo_b_cost_per_kg * 2.20462)) < 0.001 
    THEN '✅ Sincronizado' 
    ELSE '❌ Desincronizado' 
  END as estado
FROM shipping_tiers
WHERE tier_name = 'Express Aéreo';
```

**Resultado esperado:**
```
Express Aéreo | 6.0000 | 13.2277 | 13.2277 | ✅ Sincronizado
```

---

### PASO 3: Probar "Cargar desde Segmentos"

1. **En el Admin Panel** (localhost:8080/admin/global-logistics)
2. Ir a tab **"Tipos de Envío (Standard/Express)"**
3. **Editar** un tier existente (ej: Express Aéreo)
4. Clic en botón **"Cargar desde Segmentos"**
5. Verificar que **ambos campos** se llenan:
   - ✅ Costo por kg: `5.00` (desde route_logistics_costs)
   - ✅ Costo por lb: `11.0231` (auto-calculado)

6. **Editar manualmente** el campo kg a `6.00`
7. Verificar que lb se actualiza automáticamente a `13.2277`

8. **Guardar** el tier
9. Ir a la base de datos y verificar:
   ```sql
   SELECT tier_name, tramo_b_cost_per_kg, tramo_b_cost_per_lb 
   FROM shipping_tiers 
   WHERE tier_name = 'Express Aéreo';
   ```
   
   **Resultado esperado:**
   ```
   Express Aéreo | 6.0000 | 13.2277
   ```

---

### PASO 4: Verificar Cálculos en Carrito

1. **Frontend:** Agregar un producto de 2kg al carrito
2. Seleccionar **Express Aéreo**
3. Verificar costo de envío:
   - Si `tramo_b_cost_per_kg = 5.0` → **$24.00**
   - Si `tramo_b_cost_per_kg = 6.0` → **$26.00**

**Cálculo esperado (para 2kg con Express):**
```
Peso redondeado: CEIL(2.0) = 2 kg
Tramo A: 2 kg × $7.00/kg = $14.00
Tramo B: 2 kg × $5.00/kg = $10.00  ✅ USA KG, NO LB
─────────────────────────────────
Total: $24.00 ✅
```

---

## 🔍 Verificación Completa

### SQL: Comprobar Sincronización

```sql
SELECT 
  tier_name,
  transport_type,
  '──────' as "───",
  tramo_a_cost_per_kg as "A ($/kg)",
  tramo_b_cost_per_kg as "B ($/kg)",
  tramo_b_cost_per_lb as "B ($/lb)",
  '══════' as "═══",
  ROUND(tramo_b_cost_per_kg * 2.20462, 4) as "B lb esperado",
  CASE 
    WHEN ABS(tramo_b_cost_per_lb - (tramo_b_cost_per_kg * 2.20462)) < 0.001 
    THEN '✅' ELSE '❌' 
  END as "Sync OK"
FROM shipping_tiers
WHERE is_active = TRUE
ORDER BY transport_type, tier_name;
```

### SQL: Confirmar Cálculos

```sql
SELECT 
  tier_name,
  transport_type,
  (tramo_a_cost_per_kg + tramo_b_cost_per_kg) as "Total $/kg",
  csc.total_cost_with_type as "Costo 2kg"
FROM shipping_tiers st
CROSS JOIN LATERAL (
  SELECT * FROM calculate_shipping_cost_cart(2.0, st.id, false, null, null, null)
) csc
WHERE st.is_active = TRUE;
```

**Resultado esperado:**
```
Express Aéreo     | aereo    | 12.00 | $24.00
Marítimo Estándar | maritimo |  5.30 | $10.60
```

---

## 🎯 Comportamiento del Sistema

### Auto-Sincronización (Trigger en DB)

| Acción | Resultado |
|--------|-----------|
| Actualizar `tramo_b_cost_per_kg = 6.0` | `tramo_b_cost_per_lb = 13.2277` ✅ |
| Actualizar `tramo_b_cost_per_lb = 11.0231` | `tramo_b_cost_per_kg = 5.0` ✅ |
| INSERT nuevo tier con solo kg | lb se calcula automáticamente ✅ |
| INSERT nuevo tier con solo lb | kg se calcula automáticamente ✅ |

### Botón "Cargar desde Segmentos"

**Antes:** Solo cargaba `tramo_b_cost_per_lb` (convertía kg→lb)

**Ahora:**
```typescript
✅ tramo_b_cost_per_kg: tramoB.cost_per_kg,           // Directo desde segmento
✅ tramo_b_cost_per_lb: tramoB.cost_per_kg * 2.20462, // Calculado
```

### UI: Campos Sincronizados

```
┌─────────────────────────────────────────┐
│ Tramo B: Hub → Destino                 │
├─────────────────────┬───────────────────┤
│ Costo por kg (USD)  │ Costo por lb      │
│ (fuente de verdad)  │ (auto-calculado)  │
│                     │                   │
│  [    5.00    ]     │  [   11.0231  ]   │
│                     │   (verde, sync)   │
└─────────────────────┴───────────────────┘

💡 Editar kg → actualiza lb
💡 Editar lb → actualiza kg
```

---

## ⚠️ Compatibilidad con Código Existente

### Fallback Automático

Si algún tier antiguo NO tiene `tramo_b_cost_per_kg`, la función SQL usa fallback:

```sql
IF v_tier.tramo_b_cost_per_kg IS NULL OR v_tier.tramo_b_cost_per_kg = 0 THEN
  SELECT tramo_b_cost_per_lb / 2.20462 INTO v_tier.tramo_b_cost_per_kg
  FROM shipping_tiers WHERE id = p_shipping_type_id;
END IF;
```

**Resultado:** No se rompe nada, sigue funcionando con datos antiguos.

---

## 🎉 Beneficios de la Migración

| Antes | Después |
|-------|---------|
| ❌ Doble conversión (×2.20462 dos veces) | ✅ Una sola conversión para display |
| ❌ $62.60 para 2kg Express | ✅ $24.00 (correcto) |
| ❌ Valores hardcodeados ≠ segmentos | ✅ Sincronizado con route_logistics_costs |
| ❌ Botón "Cargar" solo actualiza lb | ✅ Actualiza kg (verdad) y lb (display) |
| ❌ Editar manualmente puede desincronizar | ✅ Trigger mantiene sincronización automática |
| ❌ Cálculos en libras mezcladas | ✅ TODO en kilogramos, lb solo para UI |

---

## 📞 Soporte Post-Migración

### Si algo sale mal:

**Rollback (revertir):**
```sql
-- Solo si es necesario (NO recomendado)
ALTER TABLE shipping_tiers DROP COLUMN IF EXISTS tramo_b_cost_per_kg;
DROP TRIGGER IF EXISTS trigger_sync_tramo_b_costs ON shipping_tiers;
DROP FUNCTION IF EXISTS sync_tramo_b_cost_columns();
```

### Logs de Debug:

**Verificar qué tier está usando:**
```sql
SELECT 
  st.tier_name,
  st.tramo_b_cost_per_kg,
  st.tramo_b_cost_per_lb,
  csc.*
FROM shipping_tiers st
CROSS JOIN LATERAL (
  SELECT * FROM calculate_shipping_cost_cart(2.0, st.id, false, null, null, null)
) csc
WHERE st.id = 'YOUR_TIER_ID_HERE';
```

---

## ✅ Checklist de Validación

- [ ] Ejecutar `MIGRACION_KG_COMPLETA_CON_SEGMENTOS.sql`
- [ ] Verificar columna `tramo_b_cost_per_kg` existe
- [ ] Verificar valores sincronizados con `route_logistics_costs`
- [ ] Verificar trigger `sync_tramo_b_cost_columns` activo
- [ ] Probar cálculo: 2kg Express = $24.00 ✅
- [ ] Probar "Cargar desde Segmentos" en admin
- [ ] Verificar UI muestra ambos campos (kg y lb)
- [ ] Editar kg → verificar lb se actualiza
- [ ] Guardar tier → verificar DB tiene ambos valores
- [ ] Probar carrito frontend con nuevo costo
- [ ] Verificar auto-update cuando admin cambia costos (ya implementado en hooks)

---

**🎯 Resultado Final:**
- Sistema usa solo kilogramos para cálculos
- Libras se mantienen sincronizadas para UI
- Botón "Cargar desde Segmentos" funciona perfectamente
- Trigger automático previene desincronización
- Todo retrocompatible con datos existentes
