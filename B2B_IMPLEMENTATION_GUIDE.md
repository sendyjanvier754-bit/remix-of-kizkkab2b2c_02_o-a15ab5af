# 🚀 GUÍA DE IMPLEMENTACIÓN - B2B SYSTEM REENGINEERING

**Versión**: 1.0 | **Fecha**: 31 Enero 2026  
**Scope**: Reingeniería completa del módulo B2B  
**Estimated Timeline**: 3-4 semanas (con dedicación full-time)

---

## 📋 TABLA DE CONTENIDOS

1. [Prerequisitos](#prerequisitos)
2. [Fase 0: Preparación](#fase-0-preparación)
3. [Fase 1: Migración SQL](#fase-1-migración-sql)
4. [Fase 2: Validación de Datos](#fase-2-validación-de-datos)
5. [Fase 3: Servicios Frontend](#fase-3-servicios-frontend)
6. [Fase 4: Componentes React](#fase-4-componentes-react)
7. [Fase 5: Testing E2E](#fase-5-testing-e2e)
8. [Fase 6: Go Live](#fase-6-go-live)

---

## ✅ PREREQUISITOS

### Requisitos del Sistema
- [ ] Supabase CLI instalado y logged-in (`supabase --version`)
- [ ] Node.js 18+ y npm
- [ ] PostgreSQL 14+ en Supabase
- [ ] Acceso de Admin al proyecto Supabase

### Validar Estado Actual
```bash
# 1. Verificar conexión a Supabase
npx supabase projects list

# 2. Verificar tablas existentes
# Conectar a: https://supabase.com/dashboard → SQL Editor
# Ejecutar: SELECT table_name FROM information_schema.tables 
#           WHERE table_schema='public' LIMIT 20;

# 3. Verificar datos en tablas base
# - products (debe existir)
# - shipping_routes (debe existir)
# - communes (debe existir)
# - destination_countries (debe existir)
```

---

## 🔧 FASE 0: PREPARACIÓN

### 0.1: Backup de BD Actual

```sql
-- En Supabase SQL Editor
-- Crear snapshot manual
SELECT 'Backup iniciado a ' || now();

-- Exportar estructura de productos
COPY (
  SELECT id, name, sku, weight_kg, costo_base_excel
  FROM products
  LIMIT 100
) TO STDOUT WITH CSV HEADER;
```

**Recomendación**: Usar Supabase Dashboard → Backups → Manual Backup

### 0.2: Crear Rama en Git

```bash
git checkout -b feature/b2b-reengineering
git pull origin main
```

### 0.3: Verificar Archivo SQL

```bash
# El archivo debe existir:
# c:\Users\STAVE RICHARD DORVIL\kizkkab2b2c\20260131_b2b_engineering_migration.sql

# Contar líneas
wc -l 20260131_b2b_engineering_migration.sql
# Esperado: ~800 líneas
```

---

## 🗄️ FASE 1: MIGRACIÓN SQL

### 1.1: Ejecutar Migración Completa

**OPCIÓN A: Supabase Dashboard (RECOMENDADO)**

```
1. Ir a: https://supabase.com/dashboard
2. Seleccionar proyecto: kizkkasupabaseee
3. SQL Editor → New Query
4. Copiar TODO el contenido de: 20260131_b2b_engineering_migration.sql
5. Click: "Run"
6. Esperar: ~30-60 segundos
7. Verificar: Ver "Success" al final
```

**OPCIÓN B: Supabase CLI (Terminal)**

```bash
# 1. En el workspace
cd c:\Users\STAVE RICHARD DORVIL\kizkkab2b2c

# 2. Ejecutar migración
supabase db push --linked

# 3. Seleccionar: 20260131_b2b_engineering_migration.sql

# 4. Esperar confirmación
```

### 1.2: Validar Que Todo Se Creó

```sql
-- Verificar TABLAS
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' 
AND table_name IN (
  'shipping_zones',
  'shipping_tiers', 
  'master_purchase_orders',
  'po_items',
  'po_tracking_ids'
);
-- Esperado: 5 filas

-- Verificar FUNCIONES
SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public'
AND routine_type='FUNCTION'
AND routine_name LIKE 'calculate_%' 
  OR routine_name LIKE 'validate_%'
  OR routine_name LIKE 'generate_%';
-- Esperado: 6+ filas

-- Verificar VISTAS
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
AND table_type='VIEW'
AND table_name LIKE 'v_%';
-- Esperado: 3+ filas
```

### 1.3: Verificar Índices

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname='public'
AND indexname LIKE 'idx_%';
-- Esperado: 12+ índices
```

---

## 📊 FASE 2: VALIDACIÓN DE DATOS

### 2.1: Carregar Datos de Prueba - SHIPPING_ZONES

```sql
-- Insertar zonas para Haití (ejemplo)
INSERT INTO public.shipping_zones (country_id, zone_code, zone_name, zone_level, zone_surcharge)
SELECT id, 'HT-CAP', 'Capital - Port-au-Prince', 1, 0
FROM public.destination_countries 
WHERE country_name = 'Haiti'
LIMIT 1;

INSERT INTO public.shipping_zones (country_id, zone_code, zone_name, zone_level, zone_surcharge)
SELECT id, 'HT-URBAN', 'Zonas Urbanas', 2, 5
FROM public.destination_countries 
WHERE country_name = 'Haiti'
LIMIT 1;

INSERT INTO public.shipping_zones (country_id, zone_code, zone_name, zone_level, zone_surcharge)
SELECT id, 'HT-RURAL', 'Zonas Rurales', 3, 15
FROM public.destination_countries 
WHERE country_name = 'Haiti'
LIMIT 1;

-- Verificar inserciones
SELECT COUNT(*) FROM public.shipping_zones;
-- Esperado: 3+
```

### 2.2: Carregar Datos de Prueba - SHIPPING_TIERS

```sql
-- Obtener una ruta existente
SELECT id, destination_country_id FROM public.shipping_routes LIMIT 1;
-- Guardar el ID

-- Insertar tier STANDARD para esa ruta
INSERT INTO public.shipping_tiers (
  shipping_route_id,
  tier_type,
  tramo_a_cost_per_kg,
  tramo_a_min_cost,
  tramo_a_eta_min,
  tramo_a_eta_max,
  tramo_b_cost_per_lb,
  tramo_b_min_cost,
  tramo_b_eta_min,
  tramo_b_eta_max
) VALUES (
  'ROUTE_ID_AQUI', -- Reemplazar con el ID de arriba
  'standard',
  2.50,    -- $2.50 por KG en Tramo A
  25,      -- Mínimo $25
  7,       -- 7 días mínimo
  14,      -- 14 días máximo
  1.50,    -- $1.50 por LB en Tramo B
  15,      -- Mínimo $15
  2,       -- 2 días mínimo
  5        -- 5 días máximo
);

-- Insertar tier EXPRESS
INSERT INTO public.shipping_tiers (
  shipping_route_id,
  tier_type,
  tramo_a_cost_per_kg,
  tramo_a_min_cost,
  tramo_a_eta_min,
  tramo_a_eta_max,
  tramo_b_cost_per_lb,
  tramo_b_min_cost,
  tramo_b_eta_min,
  tramo_b_eta_max
) VALUES (
  'ROUTE_ID_AQUI',
  'express',
  3.50,    -- $3.50 por KG (más caro)
  40,      -- Mínimo $40
  4,       -- 4 días mínimo
  10,      -- 10 días máximo
  2.25,    -- $2.25 por LB (más caro)
  25,      -- Mínimo $25
  1,       -- 1 día mínimo
  3        -- 3 días máximo
);

-- Verificar
SELECT * FROM public.shipping_tiers;
-- Esperado: 2 filas
```

### 2.3: Actualizar Productos con Peso

```sql
-- IMPORTANTE: Los productos deben tener weight_g > 0 para aparecer en B2B

-- Actualizar productos de prueba con peso
UPDATE public.products
SET weight_g = 500, -- 500 gramos
    is_sensitive = false,
    is_oversize = false,
    dimensions_length_cm = 20,
    dimensions_width_cm = 15,
    dimensions_height_cm = 10
WHERE sku IN ('PROD-001', 'PROD-002')
LIMIT 5;

-- Verificar
SELECT id, name, weight_g, is_sensitive, is_oversize 
FROM public.products 
WHERE weight_g > 0
LIMIT 10;
```

### 2.4: Verificar Vista: v_products_b2b

```sql
-- Esta vista solo muestra productos con weight_g > 0
SELECT id, name, weight_g, product_class, visible_in_b2b
FROM public.v_products_b2b
LIMIT 10;
-- Esperado: Mínimo 5 filas (productos con peso)
```

### 2.5: Prueba de Función: calculate_b2b_price_multitramo

```sql
-- Obtener IDs necesarios
SELECT id FROM public.products WHERE weight_g > 0 LIMIT 1;  -- PRODUCT_ID
SELECT id FROM public.addresses LIMIT 1;  -- ADDRESS_ID

-- Ejecutar función de precios
SELECT 
  public.calculate_b2b_price_multitramo(
    'PRODUCT_ID_AQUI',
    'ADDRESS_ID_AQUI',
    'standard',
    1
  ) AS price_breakdown;

-- Esperado output:
-- {
--   "valid": true,
--   "precio_aterrizado": 150.50,
--   "desglose": {...},
--   ...
-- }
```

---

## 🎨 FASE 3: SERVICIOS FRONTEND

### 3.1: Validar Archivo Services

```bash
# Verificar que el archivo existe
ls -la src/hooks/useB2BServices.ts

# Verificar líneas
wc -l src/hooks/useB2BServices.ts
# Esperado: ~400 líneas
```

### 3.2: Instalar Dependencias (si falta algo)

```bash
npm install uuid
npm install @types/uuid --save-dev
```

### 3.3: Compilar TypeScript

```bash
# Validar que no hay errores de compilación
npx tsc --noEmit

# Si hay errores, mostrar con:
npm run type-check
```

---

## 🎯 FASE 4: COMPONENTES REACT

### 4.1: Crear CheckoutB2B.tsx

```bash
# Crear archivo
touch src/components/checkout/CheckoutB2B.tsx
```

```typescript
// src/components/checkout/CheckoutB2B.tsx

import React, { useEffect, useState } from 'react';
import { useB2BCheckout, useB2BPricing } from '@/hooks/useB2BServices';
import { Address } from '@/types';

interface CheckoutB2BProps {
  investorId: string;
}

export function CheckoutB2B({ investorId }: CheckoutB2BProps) {
  const {
    cart,
    selectedAddress,
    selectedTier,
    shippingOptions,
    loading,
    error,
    loadShippingOptions,
    setSelectedTier,
    recalcuateCartPrices,
    calculateTotals,
  } = useB2BCheckout();

  const totals = calculateTotals();

  const handleAddressSelect = async (address: Address) => {
    await loadShippingOptions(address);
    await recalcuateCartPrices();
  };

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="checkout-b2b-container">
      <h1>B2B Checkout</h1>

      {/* Paso 1: Dirección */}
      <section className="step-1">
        <h2>1. Seleccionar Dirección</h2>
        <AddressSelector onSelect={handleAddressSelect} />
        {selectedAddress && (
          <p>✓ Dirección: {selectedAddress.street}</p>
        )}
      </section>

      {/* Paso 2: Tipo de Envío */}
      {selectedAddress && (
        <section className="step-2">
          <h2>2. Opción de Envío</h2>
          <div className="shipping-options">
            <button
              className={selectedTier === 'standard' ? 'active' : ''}
              onClick={() => setSelectedTier('standard')}
              disabled={loading}
            >
              Standard (7-14 días)
            </button>
            <button
              className={selectedTier === 'express' ? 'active' : ''}
              onClick={() => setSelectedTier('express')}
              disabled={loading}
            >
              Express (4-10 días)
            </button>
          </div>
        </section>
      )}

      {/* Paso 3: Resumen */}
      {selectedAddress && (
        <section className="step-3">
          <h2>3. Resumen del Pedido</h2>
          <div className="summary">
            <p>Productos: ${totals.subtotalProducts.toFixed(2)}</p>
            <p>Envío: ${totals.subtotalShipping.toFixed(2)}</p>
            <p>Platform Fee (12%): ${totals.platformFees.toFixed(2)}</p>
            <h3>Total: ${totals.totalAmount.toFixed(2)}</h3>
            <p>ETA: {totals.estimatedDays.min}-{totals.estimatedDays.max} días</p>
          </div>
        </section>
      )}

      {/* Botón Confirmar */}
      {selectedAddress && (
        <section className="step-4">
          <button
            onClick={() => {
              // Crear PO (ver sección 5)
              console.log('Crear PO:', totals);
            }}
            disabled={loading || cart.length === 0}
            className="btn-primary"
          >
            {loading ? 'Procesando...' : 'Confirmar y Crear PO'}
          </button>
        </section>
      )}
    </div>
  );
}

// Componente auxiliar (placeholder)
function AddressSelector({ onSelect }: { onSelect: (addr: Address) => void }) {
  return <div>Address selector placeholder</div>;
}
```

### 4.2: Crear ProductCardB2B.tsx

```typescript
// src/components/products/ProductCardB2B.tsx

import React from 'react';
import { useB2BCheckout } from '@/hooks/useB2BServices';
import { Product } from '@/hooks/useB2BServices';

interface ProductCardB2BProps {
  product: Product;
}

export function ProductCardB2B({ product }: ProductCardB2BProps) {
  const { addToCart } = useB2BCheckout();

  return (
    <div className="product-card-b2b">
      <img src={product.image_url} alt={product.name} />
      <h3>{product.name}</h3>
      <p className="sku">SKU: {product.sku}</p>

      {/* Clase del producto */}
      <span className={`badge ${product.product_class}`}>
        {product.product_class.toUpperCase()}
      </span>

      {/* Especificaciones */}
      <div className="specs">
        <p>Peso: {product.weight_g}g</p>
        {product.is_oversize && <p>🔴 Oversize</p>}
        {product.is_sensitive && <p>⚠️ Sensible</p>}
      </div>

      {/* Precio base */}
      <p className="price">${product.costo_base_excel.toFixed(2)}</p>

      {/* Botón agregar */}
      <button
        onClick={() => addToCart(product, 1)}
        className="btn-add-to-cart"
      >
        Agregar al Carrito
      </button>
    </div>
  );
}
```

---

## 🧪 FASE 5: TESTING E2E

### 5.1: Test Manual - Flujo Completo

**Escenario 1: Producto Normal**
```
1. Ir a: http://localhost:5173/b2b/checkout
2. Seleccionar producto: "Widget A" (500g)
3. Agregar al carrito
4. Seleccionar dirección: "Port-au-Prince, Haiti"
5. Seleccionar envío: "Standard"
6. Verificar precio aterrizado (debe incluir Tramo A + Tramo B)
7. Click: "Confirmar"
8. Validar PO creada en BD
```

**Escenario 2: Producto Oversize**
```
1. Seleccionar producto "Big Box" (50cm x 40cm x 30cm, 2000g)
2. En checkout, opción "Express" debe estar DESHABILITADA
3. Verificar que solo permite "Standard"
4. Verificar recargo oversize en desglose
```

**Escenario 3: Producto Sensible**
```
1. Seleccionar "Fragile Electronics" (100g, sensible)
2. Verificar recargo "sensible" en desglose (+5% del peso)
3. Ambos envíos permitidos (Standard + Express)
```

### 5.2: Test de BD - Validar Datos

```sql
-- Verificar PO creada
SELECT * FROM public.master_purchase_orders 
WHERE investor_id = 'USER_ID_AQUI' 
ORDER BY created_at DESC LIMIT 1;

-- Verificar items en PO
SELECT poi.*, p.name
FROM public.po_items poi
JOIN public.products p ON poi.product_id = p.id
WHERE poi.po_id = 'PO_ID_AQUI';

-- Verificar tracking ID
SELECT * FROM public.po_tracking_ids 
WHERE po_id = 'PO_ID_AQUI';
```

### 5.3: Test de Performance

```sql
-- Ejecutar función con EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT public.calculate_b2b_price_multitramo(
  'PRODUCT_ID',
  'ADDRESS_ID',
  'standard',
  1
);
-- Esperado: < 100ms
```

---

## 🚀 FASE 6: GO LIVE

### 6.1: Pre-Launch Checklist

- [ ] Todas las funciones SQL tesadas y validadas
- [ ] Componentes React compilando sin errores
- [ ] Testing E2E completado en staging
- [ ] Datos de prueba validados
- [ ] Backup BD creado
- [ ] Documentación actualizada
- [ ] Team informado del cambio

### 6.2: Deployment Steps

```bash
# 1. Merge a main
git add .
git commit -m "feat: B2B system reengineering complete"
git push origin feature/b2b-reengineering
# → Crear Pull Request y merge

# 2. Deploy frontend
npm run build
npm run deploy

# 3. Verificar en producción
# https://app.exemplo.com/b2b/checkout
```

### 6.3: Post-Launch Monitoring

```sql
-- Verificar POs creadas en producción
SELECT COUNT(*) as total_pos, 
       COUNT(DISTINCT investor_id) as unique_investors
FROM public.master_purchase_orders
WHERE created_at > now() - interval '1 day';

-- Verificar errores de precios
SELECT * FROM public.master_purchase_orders
WHERE total_amount = 0 OR total_amount IS NULL;

-- Verificar items sin shipping cost
SELECT COUNT(*) FROM public.po_items
WHERE shipping_cost = 0;
```

---

## 🆘 TROUBLESHOOTING

### Problema 1: "Función no encontrada"

```
Error: function calculate_b2b_price_multitramo does not exist
Solución: 
1. Verificar que la migración SQL se ejecutó
2. Ir a: Supabase Dashboard → SQL Editor
3. Ejecutar: SELECT * FROM information_schema.routines WHERE routine_name = 'calculate_b2b_price_multitramo';
4. Si no existe, copiar-pegar la función nuevamente
```

### Problema 2: "RLS Policy denying access"

```
Error: new row violates row-level security policy
Solución:
1. Verificar que el usuario está autenticado
2. Ejecutar: SELECT auth.uid();
3. Verificar policies en: Supabase Dashboard → Authentication → Policies
```

### Problema 3: "Peso del producto es 0"

```
Error: "Producto sin peso - bloqueado en B2B"
Solución:
1. Actualizar producto: UPDATE products SET weight_g = 500 WHERE id = ...;
2. Verificar que weight_g > 0
```

---

## 📊 MÉTRICAS DE ÉXITO

Después de Go Live, validar:

1. **Funcionalidad**
   - [ ] Mínimo 10 POs creadas
   - [ ] 100% de POs con precios correctos
   - [ ] Tracking IDs generados correctamente

2. **Performance**
   - [ ] Tiempo promedio checkout < 3 segundos
   - [ ] Función pricing < 100ms

3. **Datos**
   - [ ] 0 errores de RLS
   - [ ] 0 POs con total_amount = 0
   - [ ] 100% de items con shipping_cost > 0

---

## 📞 CONTACTO Y SOPORTE

Para dudas o problemas:
1. Revisar documentación: B2B_ENGINEERING_SPEC_COMPLETE.md
2. Revisar migraciones: 20260131_b2b_engineering_migration.sql
3. Revisar servicios: src/hooks/useB2BServices.ts

---

**Status**: ✅ Listo para implementación  
**Next Steps**: Ejecutar Fase 1 (Migración SQL)

