# 📊 SIVER MARKET 509 - Auditoría Completa de Base de Datos

**Fecha de auditoría:** 2026-01-31  
**Estado actual:** Base de datos VACÍA - requiere ejecución de migraciones  
**Archivo de migración disponible:** `supabase/migrations/DATABASE_SCHEMA_MIGRATION.sql`

---

## 📋 RESUMEN EJECUTIVO

| Categoría | Total | Estado |
|-----------|-------|--------|
| **Tablas requeridas** | 85+ | ❌ No creadas |
| **Funciones RPC** | 20+ | ❌ No creadas |
| **Vistas** | 2 | ❌ No creadas |
| **Políticas RLS** | 50+ | ❌ No creadas |
| **Tipos ENUM** | 8 | ❌ No creados |

---

## ⭐ CRÍTICO - Tablas Core (Prioridad 1)

Estas tablas son **INDISPENSABLES** para el funcionamiento básico:

### 1. `products` - Catálogo B2B Principal
```
Campos críticos: id, sku_interno, nombre, precio_mayorista, moq, stock_fisico
Referencias: categories, suppliers, shipping_origins
Uso: src/hooks/useCatalog.tsx, useProducts.ts, useB2BCartSupabase.ts
```

### 2. `categories` - Categorías de Productos
```
Campos críticos: id, name, slug, parent_id, is_visible_public
Referencias: parent_id (self-reference)
Uso: src/hooks/useCategories.ts, useCatalog.tsx
```

### 3. `b2b_carts` / `b2b_cart_items` - Carrito B2B
```
Campos críticos: cart_id, product_id, variant_id, quantity, unit_price
Referencias: products, product_variants
Uso: src/hooks/useB2BCartSupabase.ts, useCartB2B.ts
```

### 4. `b2c_carts` / `b2c_cart_items` - Carrito B2C
```
Campos críticos: cart_id, seller_catalog_id, store_id, quantity
Referencias: seller_catalog, stores
Uso: src/hooks/useB2CCartSupabase.ts, contexts/B2CCartContext.tsx
```

### 5. `orders_b2b` / `order_items_b2b` - Pedidos B2B
```
Campos críticos: id, seller_id, status, payment_status, total_amount
Referencias: products, product_variants
Uso: src/hooks/useOrders.ts, useBuyerOrders.ts
```

### 6. `orders_b2c` / `order_items_b2c` - Pedidos B2C
```
Campos críticos: id, buyer_user_id, store_id, status, payment_status
Referencias: seller_catalog, stores, pickup_points
Uso: src/hooks/useB2COrders.ts
```

---

## 🔴 ALTA PRIORIDAD - Usuarios y Autenticación (Prioridad 2)

### 7. `profiles` - Perfiles de Usuario
```
Campos: id, email, full_name, phone, avatar_url, banner_url
Uso: src/hooks/useAuth.tsx
```

### 8. `user_roles` - Roles de Usuario
```
Campos: user_id, role (app_role ENUM)
Valores: 'admin', 'seller', 'user', 'gestor', 'investor'
Uso: src/hooks/useAuth.tsx, lib/verifyRole.ts
```

### 9. `stores` - Tiendas de Vendedores
```
Campos: id, owner_user_id, name, slug, whatsapp, is_active
Uso: src/hooks/useStore.ts, ViewModeContext.tsx
```

### 10. `addresses` - Direcciones de Usuario
```
Campos: user_id, full_name, street_address, city, is_default
Uso: src/hooks/useAddresses.ts
```

### 11. `notifications` - Notificaciones
```
Campos: user_id, type, title, message, is_read
Uso: src/hooks/useNotifications.ts, useRealtimeNotifications.ts
```

---

## 🟡 MEDIA PRIORIDAD - Logística y Pagos (Prioridad 3)

### 12-16. Sistema de Logística
```
- shipping_origins
- destination_countries
- transit_hubs
- shipping_routes
- route_logistics_costs
```

### 17-19. Ubicaciones
```
- departments
- communes
- pickup_points
```

### 20-22. Mercados
```
- markets
- market_payment_methods
- payment_methods
```

### 23-25. Pagos B2B
```
- b2b_payments
- seller_wallets
- wallet_transactions
- withdrawal_requests
```

---

## 🟢 PRIORIDAD NORMAL - Features Secundarios (Prioridad 4)

### Inventario
```
- seller_catalog
- product_variants
- inventory_movements
- stock_reservations
- b2b_batches
- batch_inventory
```

### Consolidación
```
- master_purchase_orders
- po_order_links
- po_picking_items
- consolidation_settings
```

### Descuentos y Créditos
```
- discount_codes
- discount_code_uses
- customer_discounts
- seller_credits
- credit_movements
- referral_codes
- referrals
```

### Reviews y Analytics
```
- product_reviews
- store_reviews
- product_views
- delivery_ratings
- catalog_click_tracking
```

### Admin y KYC
```
- admin_banners
- admin_approval_requests
- kyc_verifications
- platform_settings
- marketplace_section_settings
```

### Atributos EAV
```
- attributes
- attribute_options
- variant_attribute_values
- category_attribute_templates
```

---

## 🔧 FUNCIONES RPC REQUERIDAS

| Función | Propósito | Archivo de uso |
|---------|-----------|----------------|
| `is_admin(user_id)` | Verificar rol admin | Auth, RLS policies |
| `has_role(user_id, role)` | Verificar rol específico | Auth, RLS policies |
| `get_trending_products` | Productos populares | useTrendingProducts.ts |
| `match_products` | Búsqueda por vector/embedding | imageSearch.ts |
| `generate_po_number` | Generar número PO | usePurchaseOrders.ts |
| `generate_match_sale_number` | Número de venta Siver Match | useSiverMatch.ts |
| `get_or_create_active_po` | PO activo | useConsolidationEngine.ts |
| `get_consolidation_stats` | Estadísticas consolidación | useConsolidationEngine.ts |
| `link_mixed_orders_to_po` | Vincular órdenes a PO | usePurchaseOrders.ts |
| `process_mixed_po_china_tracking` | Tracking de China | usePurchaseOrders.ts |
| `update_mixed_po_logistics_stage` | Etapas logísticas | usePurchaseOrders.ts |
| `validate_courier_delivery` | Validar entrega | useDeliveryValidation.ts |
| `confirm_pickup_point_delivery` | Confirmar pickup | useDeliveryValidation.ts |
| `calculate_cart_projected_profit` | Cálculo de ganancias | useB2CMarketPrices.ts |
| `process_delivery_wallet_splits` | División de fondos | usePurchaseOrders.ts |
| `process_siver_match_wallet_split` | Fondos Siver Match | useSiverMatch.ts |
| `process_withdrawal_completion` | Procesar retiro | useSellerWallet.ts |
| `fn_expire_pending_orders` | Expirar pedidos | Edge Function |

---

## 📦 TIPOS ENUM REQUERIDOS

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'user', 'gestor', 'investor');
CREATE TYPE public.approval_request_type AS ENUM ('withdrawal', 'refund', 'credit_purchase', 'kyc_review');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_method AS ENUM ('bank_transfer', 'moncash', 'natcash', 'credit_card', 'crypto', 'cash_on_delivery');
CREATE TYPE public.payment_status AS ENUM ('pending', 'pending_validation', 'paid', 'failed', 'expired', 'refunded', 'cancelled');
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE public.stock_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'discontinued');
```

---

## 🛡️ VISTAS REQUERIDAS

### `markets_dashboard`
Vista que combina markets con información adicional para el panel admin.

---

## ⚠️ ERRORES DE BUILD ACTUALES

Los errores TypeScript actuales (`'never'` types) se deben a que la base de datos está **completamente vacía**. Una vez ejecutadas las migraciones, los tipos se regenerarán automáticamente.

```
Error: Argument of type '"products"' is not assignable to parameter of type 'never'
Causa: No hay tablas en Supabase → types.ts tiene esquema vacío
Solución: Ejecutar DATABASE_SCHEMA_MIGRATION.sql
```

---

## 📝 INSTRUCCIONES DE EJECUCIÓN

### Opción 1: SQL Editor de Supabase (Recomendado)

1. Ir a: https://supabase.com/dashboard/project/fonvunyiaxcjkodrnpox/sql/new
2. Ejecutar en orden:
   - `DATABASE_SCHEMA_MIGRATION.sql`
   - `SEED_DATA.sql`
   - `COMPLETE_SEED_DATA.sql`
   - `PRODUCT_DATA.sql`

### Opción 2: Archivo COMPLETE_SCHEMA.sql

He generado `COMPLETE_SCHEMA.sql` que contiene TODO el SQL necesario en un solo archivo.

---

## ✅ CHECKLIST POST-MIGRACIÓN

- [ ] Verificar que existen 85+ tablas
- [ ] Verificar que existen las funciones RPC
- [ ] Ejecutar `supabase gen types typescript` para regenerar types.ts
- [ ] Verificar build sin errores de TypeScript
- [ ] Probar login/auth básico
- [ ] Probar carrito B2B y B2C
