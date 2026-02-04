# PLAN DE IMPLEMENTACIÓN - ARQUITECTURA DE PRECIOS CORREGIDA

## 📋 RESUMEN DE LA LÓGICA

### Flujo de Precios:
1. **Admin configura producto en tabla `products`:**
   - `precio_mayorista_base` = Precio base B2B (solo interno)
   - Vista `v_productos_con_precio_b2b` calcula `precio_b2b` (con márgenes)
   - `precio_sugerido_venta` = PVP sugerido (OPCIONAL)

2. **Seller ve catálogo B2B (consulta VISTA):**
   - **Precio de Compra:** `precio_b2b` de la VISTA (lo que pagará al admin)
   - **PVP Sugerido:** Calculado automáticamente si no existe

3. **Cálculo de PVP Sugerido (Prioridad):**
   ```
   SI existe precio_sugerido_venta ENTONCES
       mostrar precio_sugerido_venta
   SINO SI existe otro seller vendiendo este producto ENTONCES
       mostrar PVP más alto de otros sellers
   SINO
       mostrar precio_b2b (de VISTA) × margen_categoria (ej: 4x)
   FIN
   ```

4. **Seller configura su PVP:**
   - Seller ve el precio sugerido
   - Seller configura su propio `precio_venta` en `seller_catalog`
   - `precio_costo` = copia de `precio_b2b` de la VISTA
   - Puede ser mayor, menor o igual al sugerido

**⚠️ REGLA CRÍTICA:** SIEMPRE consultar `v_productos_con_precio_b2b` (VISTA), NO la tabla `products`

---

## 🗂️ ESTRUCTURA DE DATOS NECESARIA

### 1. Agregar margen por categoría
```sql
ALTER TABLE categories 
ADD COLUMN default_markup_multiplier NUMERIC DEFAULT 4.0;

COMMENT ON COLUMN categories.default_markup_multiplier IS 
  'Multiplicador por defecto para calcular PVP sugerido. Ej: 4.0 = 400% markup';
```

### 2. Vista para obtener PVP de otros sellers
```sql
CREATE OR REPLACE VIEW v_product_max_pvp AS
SELECT 
  source_product_id,
  MAX(precio_venta) as max_pvp,
  MIN(precio_venta) as min_pvp,
  AVG(precio_venta) as avg_pvp,
  COUNT(DISTINCT seller_store_id) as num_sellers
FROM seller_catalog
WHERE is_active = true
GROUP BY source_product_id;
```

---

## ✅ LISTA DE TAREAS

### FASE 1: Base de Datos y Funciones

- [ ] **Tarea 1.1:** Crear migración para agregar `default_markup_multiplier` a `categories`
  - Archivo: `supabase/migrations/20260203_add_category_markup.sql`
  - Establecer valores por defecto (4.0 para todas las categorías)

- [ ] **Tarea 1.2:** Crear vista `v_product_max_pvp` para obtener PVP de otros sellers
  - Archivo: `supabase/migrations/20260203_create_pvp_view.sql`

- [ ] **Tarea 1.3:** Crear función `calculate_suggested_pvp(product_id, market_id)`
  - Archivo: `supabase/migrations/20260203_suggested_pvp_function.sql`
  - Lógica completa de cálculo de PVP sugerido
  - Parámetros: product_id, market_id (opcional)
  - Retorna: NUMERIC

---

### FASE 2: Backend (Hooks y Servicios)

- [ ] **Tarea 2.1:** Crear hook `usePricing.ts`
  - `getSuggestedPVP(productId, marketId)` → Llama a función SQL
  - `getProductB2BPrice(productId, marketId)` → Consulta VISTA `v_productos_con_precio_b2b`
  - `getOtherSellersPrices(productId)` → Consulta vista v_product_max_pvp
  - **IMPORTANTE:** Siempre usar la VISTA, nunca la tabla directa

- [ ] **Tarea 2.2:** Actualizar `useCatalog.tsx`
  - Cambiar queries para usar `v_productos_con_precio_b2b` (VISTA)
  - Interface `Product` debe incluir `precio_b2b` de la vista
  - Mantener retrocompatibilidad con código existente

- [ ] **Tarea 2.3:** Crear servicio `pricingService.ts`
  - Lógica de cálculo de precios del lado cliente
  - Validaciones de márgenes mínimos

---

### FASE 3: UI - Catálogo del Admin

- [ ] **Tarea 3.1:** Actualizar labels en `ProductEditDialog.tsx`
  - "Precio Mayorista Base" → Mantener
  - Agregar preview de "Precio B2B Dinámico" (solo lectura)

- [ ] **Tarea 3.2:** Actualizar labels en `ProductFormDialog.tsx`
  - Igual que 3.1

- [ ] **Tarea 3.3:** Agregar configuración de margen en `AdminCategories` (si existe)
  - Campo para editar `default_markup_multiplier`
  - Tooltip: "Multiplicador para calcular PVP sugerido (ej: 4 = 400%)"

---

### FASE 4: UI - Catálogo B2B (Vista del Seller)

- [ ] **Tarea 4.1:** Actualizar `B2BCatalogImportDialog.tsx`
  - Mostrar "Precio de Compra B2B: $X" (precio_b2b)
  - Mostrar "PVP Sugerido: $Y" (calculado)
  - Mostrar breakdown:
    - "Otros sellers venden a: $Z" (si existe)
    - "Margen de categoría: 4x" (si aplica)
  - Campo editable: "Tu PVP: $_____"

- [ ] **Tarea 4.2:** Actualizar lógica de importación
  ```tsx
  // ANTES (incorrecto - usa tabla directa)
  precio_costo: product.precio_mayorista_base,
  precio_venta: product.precio_sugerido_venta || Math.ceil(product.precio_mayorista_base * 1.3)
  
  // DESPUÉS (correcto - usa VISTA)
  // Asume que product viene de v_productos_con_precio_b2b
  precio_costo: product.precio_b2b,  // ✅ Precio B2B de la VISTA
  precio_venta: await getSuggestedPVP(product.id, marketId)  // ✅ Calculado
  ```
  **⚠️ CRÍTICO:** Asegurarse que `product` viene de la VISTA, no de la tabla

- [ ] **Tarea 4.3:** Crear componente `PricingBreakdown.tsx`
  - Muestra desglose de precios
  - Entrada: product, marketId
  - Salida: Card visual con pricing info

---

### FASE 5: UI - ProductPage y Carrito

- [ ] **Tarea 5.1:** Actualizar `ProductPage.tsx`
  - Cuando es vista B2B (seller comprando):
    - Mostrar "Precio de Compra: $X"
    - Mostrar "PVP Sugerido: $Y"
    - Botón "Importar a mi catálogo"
  
  - Cuando es vista B2C (cliente comprando):
    - Mostrar "Precio: $X" (precio_venta del seller_catalog)

- [ ] **Tarea 5.2:** Actualizar componentes de carrito
  - `SellerCartPage.tsx` → Usar precio_b2b
  - Verificar que cálculos de totales usen precio correcto

---

### FASE 6: Catálogo del Seller (Edición)

- [ ] **Tarea 6.1:** Crear/actualizar componente de edición de catálogo del seller
  - Mostrar "Tu Costo: $X" (precio_costo - no editable)
  - Campo editable: "Tu PVP: $_____"
  - Mostrar "Margen: $Y (Z%)"
  - Advertencia si margen es muy bajo

- [ ] **Tarea 6.2:** Validaciones de PVP
  - PVP no puede ser menor que precio_costo
  - Advertir si margen < 20%
  - Mostrar comparación con otros sellers

---

### FASE 7: Admin - Gestión de Márgenes

- [ ] **Tarea 7.1:** Crear página/sección `AdminCategoryMargins.tsx`
  - Lista de categorías con margen actual
  - Edición inline de `default_markup_multiplier`
  - Preview de impacto en precios

- [ ] **Tarea 7.2:** Dashboard de pricing
  - Vista de productos con pricing calculado
  - Comparación: precio_b2b vs PVP promedio de sellers
  - Alertas de productos con márgenes anormales

---

### FASE 8: Testing y Validación

- [ ] **Tarea 8.1:** Tests de funciones SQL
  - `calculate_suggested_pvp` con diferentes escenarios
  - Verificar cascada: sugerido → otros sellers → margen

- [ ] **Tarea 8.2:** Tests de importación
  - Seller importa producto sin precio sugerido
  - Seller importa producto con precio sugerido
  - Seller importa producto que otros ya venden

- [ ] **Tarea 8.3:** Validación de cálculos
  - Verificar que precio_b2b se usa correctamente
  - Verificar que PVP sugerido es correcto
  - Verificar márgenes del seller

---

### FASE 9: Documentación

- [ ] **Tarea 9.1:** Documentar nueva arquitectura
  - Diagrama de flujo de precios
  - Ejemplos de cálculos

- [ ] **Tarea 9.2:** Guía para sellers
  - Cómo funciona el pricing
  - Cómo configurar PVP competitivo

- [ ] **Tarea 9.3:** Guía para admins
  - Cómo configurar márgenes por categoría
  - Cómo monitorear pricing

---

## 🔄 ORDEN DE EJECUCIÓN RECOMENDADO

1. **FASE 1** (Base de Datos) → Base crítica
2. **FASE 2** (Backend) → Lógica de negocio
3. **FASE 4** (UI Seller) → Prioridad para sellers
4. **FASE 3** (UI Admin) → Configuración
5. **FASE 5** (ProductPage) → Experiencia usuario final
6. **FASE 6** (Edición Seller) → Gestión de catálogo
7. **FASE 7** (Admin Avanzado) → Herramientas admin
8. **FASE 8** (Testing) → Validación
9. **FASE 9** (Docs) → Documentación

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Migración de Datos Existentes
- Productos en `seller_catalog` con `precio_costo` basado en `precio_mayorista_base` de tabla
- Necesitaremos migración para actualizar a `precio_b2b` de VISTA
- Script de migración:
  ```sql
  -- Actualizar precio_costo con precio_b2b de la VISTA
  UPDATE seller_catalog sc
  SET precio_costo = (
    SELECT precio_b2b 
    FROM v_productos_con_precio_b2b v 
    WHERE v.id = sc.source_product_id
  )
  WHERE source_product_id IS NOT NULL;
  ```
  **⚠️ IMPORTANTE:** Esto recalculará el costo con márgenes aplicados

### Retrocompatibilidad
- Mantener `precio_mayorista` como alias de `precio_mayorista_base` temporalmente
- Agregar warnings de deprecación
- Plan de eliminación en 3 meses

### Performance
- Vista `v_productos_con_precio_b2b` puede ser costosa
- Considerar índices en `seller_catalog.source_product_id`
- Cachear precios calculados cuando sea posible

---

## 📊 MÉTRICAS DE ÉXITO

- [ ] 100% de productos muestran precio_b2b correcto
- [ ] Sellers ven PVP sugerido en 100% de casos
- [ ] Cálculo de margen es correcto en todos los casos
- [ ] No hay regresiones en checkout/carrito
- [ ] Performance de carga de catálogo < 2s

---

**Creado:** 2026-02-03
**Estado:** Pendiente de confirmación
**Prioridad:** 🔴 CRÍTICA
