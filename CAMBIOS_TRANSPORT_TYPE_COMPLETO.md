# ✅ CAMBIOS TRANSPORT_TYPE - RESUMEN COMPLETO

## 📅 Fecha: 16 Febrero 2026

## 🎯 Objetivo
Agregar campo `transport_type` (maritimo/aereo/terrestre) a **AMBAS** tablas:
1. `route_logistics_costs` (tramos individuales)
2. `shipping_tiers` (tipos de envío para clientes)

---

## 📊 CAMBIOS EN BASE DE DATOS

### 1. route_logistics_costs
**Archivo:** `ADD_TRANSPORT_TYPE_TO_ROUTE_COSTS.sql`

```sql
ALTER TABLE public.route_logistics_costs
ADD COLUMN transport_type VARCHAR(20) NOT NULL DEFAULT 'aereo'
CHECK (transport_type IN ('maritimo', 'aereo', 'terrestre'));

UPDATE public.route_logistics_costs
SET transport_type = 'aereo';
```

✅ Todos los tramos existentes → `'aereo'`

---

### 2. shipping_tiers
**Archivo:** `ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql`

```sql
ALTER TABLE public.shipping_tiers
ADD COLUMN transport_type VARCHAR(20) NOT NULL DEFAULT 'aereo'
CHECK (transport_type IN ('maritimo', 'aereo', 'terrestre'));

UPDATE public.shipping_tiers
SET transport_type = CASE
  WHEN tier_type = 'standard' THEN 'maritimo'
  WHEN tier_type = 'express' THEN 'aereo'
  ELSE 'aereo'
END;
```

✅ Standard tiers → `'maritimo'`
✅ Express tiers → `'aereo'`

---

## 💻 CAMBIOS EN FRONTEND

### 1. Interface ShippingTier (TypeScript)
**Archivo:** `src/types/b2b-shipping.ts`

```typescript
export interface ShippingTier {
  id: string;
  route_id: string;
  tier_type: 'standard' | 'express';
  tier_name: string;
  tier_description?: string;
  transport_type: 'maritimo' | 'aereo' | 'terrestre'; // ← NUEVO
  // ... resto de campos
}
```

---

### 2. AdminGlobalLogisticsPage.tsx

#### Interface ShippingTier (línea ~56)
```typescript
interface ShippingTier {
  id?: string;
  route_id: string;
  tier_type: 'standard' | 'express';
  tier_name: string;
  transport_type: 'maritimo' | 'aereo' | 'terrestre'; // ← NUEVO
  // ... resto
}
```

#### Estado inicial tierForm (línea ~178)
```typescript
const [tierForm, setTierForm] = useState({
  route_id: "",
  tier_type: 'standard' as 'standard' | 'express',
  tier_name: "",
  transport_type: 'aereo' as 'maritimo' | 'aereo' | 'terrestre', // ← DEFAULT AEREO
  // ... resto
});
```

#### Selector de Transport Type (línea ~1837)
```tsx
<Select 
  value={tierForm.transport_type} 
  onValueChange={(v: 'maritimo' | 'aereo' | 'terrestre') => 
    setTierForm(prev => ({ ...prev, transport_type: v }))
  }
>
  <SelectContent>
    <SelectItem value="maritimo">
      <Ship /> Marítimo
    </SelectItem>
    <SelectItem value="aereo">
      <Plane /> Aéreo
    </SelectItem>
    <SelectItem value="terrestre">
      <Package /> Terrestre
    </SelectItem>
  </SelectContent>
</Select>
```

---

### 3. AdminLogisticaRutas.tsx

#### Interface ShippingTier (línea ~25)
```typescript
interface ShippingTier {
  id: string;
  route_id: string;
  tier_type: 'standard' | 'express';
  transport_type: 'maritimo' | 'aereo' | 'terrestre'; // ← NUEVO
  // ... resto
}
```

#### Estado inicial formData (línea ~519)
```typescript
const [formData, setFormData] = useState({
  route_id: tier?.route_id || '',
  tier_type: tier?.tier_type || 'standard',
  tier_name: tier?.tier_name || '',
  transport_type: tier?.transport_type || 'aereo', // ← DEFAULT AEREO
  // ... resto
});
```

#### Selector de Transport Type (línea ~627)
```tsx
<Select
  value={formData.transport_type}
  onValueChange={(value: 'maritimo' | 'aereo' | 'terrestre') => 
    setFormData({ ...formData, transport_type: value })
  }
>
  <SelectContent>
    <SelectItem value="maritimo">
      <Ship /> Marítimo (15-30 días)
    </SelectItem>
    <SelectItem value="aereo">
      <Plane /> Aéreo (5-10 días)
    </SelectItem>
    <SelectItem value="terrestre">
      <Package /> Terrestre (7-15 días)
    </SelectItem>
  </SelectContent>
</Select>
```

---

## 🚀 PASOS PARA APLICAR

### 1. Ejecutar SQL para route_logistics_costs
```bash
psql -d tu_base_de_datos -f ADD_TRANSPORT_TYPE_TO_ROUTE_COSTS.sql
```

### 2. Ejecutar SQL para shipping_tiers
```bash
psql -d tu_base_de_datos -f ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql
```

### 3. Verificar en Supabase
- Ve a Table Editor → `route_logistics_costs`
- Verifica columna `transport_type` existe con valor `'aereo'`
- Ve a Table Editor → `shipping_tiers`
- Verifica columna `transport_type` existe (standard=maritimo, express=aereo)

### 4. Probar en Frontend
1. Ve a Admin → Global Logistics
2. Crea nuevo tramo → Verifica 3 opciones de transporte
3. Crea nuevo tier → Verifica 3 opciones de transporte
4. Edita existentes → Default debe ser 'aereo'

---

## 📋 CHECKLIST DE VERIFICACIÓN

### Base de Datos
- [ ] route_logistics_costs tiene columna transport_type
- [ ] Todos los tramos existentes están en 'aereo'
- [ ] shipping_tiers tiene columna transport_type
- [ ] Standard tiers están en 'maritimo'
- [ ] Express tiers están en 'aereo'

### Frontend
- [ ] Interface ShippingTier tiene transport_type
- [ ] Selector muestra 3 opciones (maritimo/aereo/terrestre)
- [ ] Default es 'aereo' al crear nuevo
- [ ] Se puede editar transport_type de existentes
- [ ] Iconos se muestran correctamente (🚢✈️📦)

### Funcionalidad
- [ ] Crear nuevo tramo con cada tipo de transporte
- [ ] Crear nuevo tier con cada tipo de transporte
- [ ] Editar tramo existente y cambiar transport_type
- [ ] Editar tier existente y cambiar transport_type
- [ ] Los cambios se guardan correctamente en la DB

---

## 🎨 ICONOS POR TIPO

| Tipo | Icono | Descripción |
|------|-------|-------------|
| maritimo | 🚢 Ship | Transporte por barco - Más lento, económico |
| aereo | ✈️ Plane | Transporte aéreo - Más rápido, costoso |
| terrestre | 📦 Package | Transporte terrestre - Flexible, medio |

---

## 📝 NOTAS IMPORTANTES

1. **Default es 'aereo'**: Todos los nuevos registros tendrán transport_type='aereo' por defecto
2. **Standard tiers**: Al ejecutar el SQL, se actualizan automáticamente a 'maritimo'
3. **Express tiers**: Se actualizan automáticamente a 'aereo'
4. **Validación**: CHECK constraint impide valores que no sean maritimo/aereo/terrestre
5. **NOT NULL**: El campo es obligatorio, no puede ser NULL

---

## 🔗 ARCHIVOS MODIFICADOS

### SQL
1. `ADD_TRANSPORT_TYPE_TO_ROUTE_COSTS.sql` (nuevo)
2. `ADD_TRANSPORT_TYPE_TO_SHIPPING_TIERS.sql` (nuevo)
3. `EXPLICACION_SHIPPING_TIERS.sql` (nuevo - documentación)

### TypeScript
1. `src/types/b2b-shipping.ts` (interface ShippingTier)
2. `src/pages/admin/AdminGlobalLogisticsPage.tsx` (interface, form, selector)
3. `src/pages/admin/AdminLogisticaRutas.tsx` (interface, form, selector)

---

## 📖 DOCUMENTACIÓN ADICIONAL

Ver `EXPLICACION_SHIPPING_TIERS.sql` para entender:
- Diferencia entre route_logistics_costs y shipping_tiers
- Cuándo usar cada tabla
- Ejemplos de uso

---

## ✅ COMPLETADO

Todos los cambios están implementados y listos para ejecutar.
Solo falta ejecutar los 2 archivos SQL en Supabase.
