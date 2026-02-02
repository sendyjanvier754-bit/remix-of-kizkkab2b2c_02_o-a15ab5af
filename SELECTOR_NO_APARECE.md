# 🚨 Por Qué No Aparece el Selector de Tipo de Envío

## Problema Actual

El selector B2BShippingSelector **NO aparece** en el checkout porque faltan configuraciones en la base de datos.

---

## ✅ Solución (Paso a Paso)

### Paso 1: Ejecutar Migraciones SQL en Supabase

**Primero debes ejecutar estas migraciones:**

1. Ir a **Supabase Dashboard** → **SQL Editor**
2. Ejecutar este SQL:

```sql
-- 1. Migración peso_gramos
-- Copiar contenido de: supabase/migrations/20260202_peso_gramos.sql
-- Ejecutar en Supabase

-- 2. Migración transport_type
-- Copiar contenido de: supabase/migrations/20260202_transport_type.sql  
-- Ejecutar en Supabase
```

**Archivos a ejecutar:**
- ✅ `supabase/migrations/20260202_peso_gramos.sql` (297 líneas)
- ✅ `supabase/migrations/20260202_transport_type.sql` (14 líneas)

---

### Paso 2: Configurar Rutas en Admin

1. **Ir a**: `http://localhost:5173/admin/logistica/rutas`

2. **Crear una ruta**:
   - Click en `[+ Nueva Ruta]`
   - Nombre: "China → USA → Haití"
   - Origen: CN
   - Destino: HT
   - Activa: ✓
   - Guardar

3. **Seleccionar la ruta creada** (click en ella)

---

### Paso 3: Agregar Tipo Standard

Con la ruta seleccionada:

1. Click `[+ Nuevo Tipo de Envío]`
2. Configurar:
   ```
   Tipo de Envío: Standard
   Transporte: Marítimo
   Nombre: "Standard - Consolidado Marítimo"
   
   Tramo A (China → USA):
     Costo por kg: $8.00
     Costo mínimo: $5.00
     ETA mínimo: 15 días
     ETA máximo: 25 días
   
   Tramo B (USA → Haití):
     Costo por lb: $5.00
     Costo mínimo: $3.00
     ETA mínimo: 3 días
     ETA máximo: 7 días
   
   ✓ Permite oversize
   ✓ Permite sensibles
   ✓ Activo
   ```
3. Guardar

---

### Paso 4: (Opcional) Agregar Tipo Express

1. Click `[+ Nuevo Tipo de Envío]` nuevamente
2. Configurar:
   ```
   Tipo de Envío: Express
   Transporte: Aéreo
   Nombre: "Express - Prioritario"
   
   Tramo A: $15.00/kg, 5-10 días
   Tramo B: $10.00/lb, 1-3 días
   
   ✗ NO oversize
   ✓ Sensibles
   ✓ Activo
   ```
3. Guardar

---

### Paso 5: Verificar en Checkout

Ahora cuando vayas al checkout:

1. Selecciona "Envío a Domicilio"
2. Elige una dirección
3. **¡El selector debe aparecer!** 🎉

---

## 🔍 Debugging

Agregué logs en la consola del navegador. Abre DevTools (F12) y verás:

```bash
# Si no se carga:
🔍 No se carga selector: { selectedAddressId: null, deliveryMethod: 'pickup' }

# Cuando intenta cargar:
🚀 Cargando opciones de envío para dirección: abc-123...

# Si hay opciones:
✅ Opciones cargadas: [{ tier_type: 'standard', ... }]

# Si NO hay opciones:
⚠️ Sin opciones o respuesta inválida: "No shipping routes found"

# Si hay error:
❌ Error loading shipping options: Error...
```

---

## 📊 Estados del Selector

### Estado 1: Loading
```
┌─────────────────────────────────┐
│ 🔄 Cargando opciones de envío  │
└─────────────────────────────────┘
```

### Estado 2: Sin Opciones (ACTUAL)
```
┌─────────────────────────────────────────┐
│ ⚠️ Sin opciones de envío configuradas  │
│                                          │
│ No hay tipos de envío disponibles       │
│ para esta dirección.                    │
│                                          │
│ Para solucionar: Configurar en          │
│ /admin/logistica/rutas                  │
└─────────────────────────────────────────┘
```

### Estado 3: Con Opciones (OBJETIVO)
```
┌─────────────────────────────────┐
│ 🚚 Tipo de Envío                │
│                                  │
│ ┌─────────────────────────────┐ │
│ │ 📦 Standard - $8/kg         │ │
│ │ Tramo A: 15-25 días         │ │
│ │ Tramo B: 3-7 días           │ │
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │
│ │ ⚡ Express - $15/kg          │ │
│ │ Tramo A: 5-10 días          │ │
│ │ Tramo B: 1-3 días           │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## ⚠️ Problemas Comunes

### Problema 1: "⚠️ Sin opciones o respuesta inválida"
**Causa**: No hay rutas configuradas o dirección no tiene zona
**Solución**: 
- Verificar que creaste rutas en admin
- Verificar que dirección tiene zona asignada en tabla `addresses`

### Problema 2: Selector no aparece
**Causa**: `shippingOptions.length === 0`
**Solución**: Configurar rutas como se indica arriba

### Problema 3: Error en consola
**Causa**: Migraciones SQL no ejecutadas
**Solución**: Ejecutar migraciones en Supabase primero

### Problema 4: RPC function error
**Causa**: Función `get_shipping_options_for_address` no existe
**Solución**: Ejecutar `20260202_peso_gramos.sql` que contiene todas las funciones

---

## 🎯 Checklist Completo

Para que el selector aparezca:

- [ ] **1. Migraciones SQL ejecutadas** en Supabase
- [ ] **2. Ruta creada** en `/admin/logistica/rutas`
- [ ] **3. Tipo Standard configurado** para la ruta
- [ ] **4. (Opcional) Tipo Express configurado**
- [ ] **5. Ruta marcada como activa**
- [ ] **6. Dirección seleccionada** en checkout
- [ ] **7. "Envío a Domicilio" seleccionado**

---

## 🚀 Acceso Rápido

- **Admin Rutas**: `http://localhost:5173/admin/logistica/rutas`
- **Checkout**: `http://localhost:5173/seller/checkout`
- **Supabase**: Tu dashboard de Supabase

---

## 📝 Nota Importante

**El selector solo funciona si:**
1. ✅ Las migraciones están ejecutadas
2. ✅ Hay rutas configuradas con tipos de envío
3. ✅ La dirección seleccionada tiene zona asignada
4. ✅ Existe una ruta que cubra esa zona

**Sin esto, verás el mensaje naranja de "Sin opciones configuradas".**

---

## 🔧 Siguiente Paso AHORA

1. **PRIMERO**: Ejecutar migraciones SQL en Supabase
2. **SEGUNDO**: Ir a `/admin/logistica/rutas` y configurar
3. **TERCERO**: Probar en checkout

¡Una vez hagas esto, el selector aparecerá! 🎉
