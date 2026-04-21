

# Plan: Nuevo rol `grossiste` (Mayorista)

Crear un rol independiente que **publica productos exclusivamente al catálogo B2B** visible para sellers/admin, con panel propio de gestión, importación masiva, liquidación de pagos vía plataforma, y opción de tienda B2C.

---

## 1. Modelo conceptual

| Aspecto | Comportamiento |
|---|---|
| Catálogo origen | Sus productos viven en `products` (mismo origen B2B que admin), marcados con `owner_user_id = grossiste` |
| Visibilidad | Aparecen en `/seller/adquisicion-lotes` y `/admin/...` junto a productos del admin, marcados con un badge "Mayorista: {nombre}" |
| Pedidos | El comprador (seller/admin) paga a la **plataforma**; la plataforma acumula deuda con el grossiste y liquida vía wallet |
| B2C opcional | Por defecto **OFF**. Toggle `enable_b2c_storefront` en su perfil → activa una tienda pública en `/tienda/{slug}` |
| Precios | El grossiste ingresa `precio_mayorista` directo + costo. Estado: `draft → pending_review → approved → published` |
| Inventario | Panel propio + importación Excel/1688 (reutiliza el flujo admin existente) |

---

## 2. Cambios de base de datos (migración)

### 2.1 Enum y rol
- `ALTER TYPE app_role ADD VALUE 'grossiste';`
- Función helper: `is_grossiste(uuid)` (security definer).

### 2.2 Tabla `products` — ownership y moderación
Agregar columnas (compatibles con datos existentes; admin queda como owner por defecto vía trigger):
- `owner_user_id UUID REFERENCES auth.users(id)` — null = admin/sistema
- `owner_role app_role DEFAULT 'admin'`
- `approval_status TEXT DEFAULT 'approved'` (`draft | pending_review | approved | rejected`)
- `approval_notes TEXT`
- `reviewed_by UUID`, `reviewed_at TIMESTAMPTZ`

### 2.3 Tabla nueva `grossiste_profiles`
Datos comerciales del mayorista:
```
user_id (PK, FK auth.users)
business_name, legal_name, tax_id
country, city, address, phone
logo_url, banner_url, description
enable_b2c_storefront BOOL DEFAULT false
b2c_store_id UUID NULL  -- creada cuando activa B2C
commission_rate NUMERIC DEFAULT 10.00  -- % que retiene la plataforma
verification_status TEXT DEFAULT 'pending'
created_at, updated_at
```

### 2.4 Liquidaciones
Nueva tabla `grossiste_settlements`:
```
id, grossiste_user_id, period_start, period_end
gross_sales, commission_amount, net_payable
status (pending | paid), paid_at, payment_reference
```
Trigger en `orders_b2b` cuando `status = 'paid'`: insertar líneas en `grossiste_earnings` agrupadas por grossiste.

### 2.5 Vista `v_productos_con_precio_b2b`
Modificar para incluir `owner_user_id`, `owner_business_name` (JOIN con grossiste_profiles/profiles) y filtrar `approval_status = 'approved' AND is_active = true`.

### 2.6 RLS

**products**:
- `Grossistes can manage own products`: USING `owner_user_id = auth.uid() AND has_role(auth.uid(),'grossiste')`
- Admin policy existente sin cambios (gestiona todos).
- SELECT público B2B: `approval_status='approved'` (existente filtra `is_active`; añadir esta condición).

**grossiste_profiles**:
- Owner can read/update own
- Admin can read/update all
- Public can read minimal fields (business_name, logo) si `enable_b2c_storefront = true`

**grossiste_settlements**: owner read-only, admin full.

### 2.7 Trigger automático
`on_user_role_grossiste_insert`: cuando se inserta rol `grossiste` en `user_roles` → crea fila en `grossiste_profiles` con defaults.

---

## 3. Frontend

### 3.1 Tipos / auth
`src/types/auth.ts`: añadir `GROSSISTE = "grossiste"` al enum `UserRole`.
`src/hooks/useAuth.tsx`: prioridad → `admin > purchasing_agent > grossiste > seller > sales_agent > user`.
`src/components/auth/ProtectedRoute.tsx` `getRoleRedirectPath`: `case GROSSISTE → /grossiste/dashboard`.

### 3.2 Layout y navegación
- Nuevo `src/components/grossiste/GrossisteLayout.tsx` (basado en `SellerLayout`, paleta diferenciada — verde/teal para distinguir de azul seller).
- Nuevo `src/components/grossiste/GrossisteSidebar.tsx` con secciones:
  - Dashboard
  - Mis Productos B2B (catálogo + crear/editar)
  - Importar (Excel / 1688)
  - Pedidos recibidos (read-only, gestionados por admin)
  - Liquidaciones / Wallet
  - Mi Tienda B2C (toggle + configuración si activo)
  - Perfil del negocio
  - Soporte

### 3.3 Páginas nuevas (`src/pages/grossiste/`)
- `GrossisteDashboard.tsx` — KPIs: productos publicados, pendientes aprobación, ventas del mes, saldo pendiente liquidación.
- `GrossisteProductsPage.tsx` — tabla CRUD con badge de `approval_status`.
- `GrossisteProductFormPage.tsx` — formulario crear/editar (reutiliza componentes del admin: `ProductForm`, variantes, imágenes).
- `GrossisteImportPage.tsx` — reutiliza `SmartBulkImportDialog` y workflow 1688 con `owner_user_id` inyectado automáticamente.
- `GrossisteOrdersPage.tsx` — listado read-only de pedidos B2B donde sus productos aparecen (con desglose por pedido).
- `GrossisteSettlementsPage.tsx` — historial de liquidaciones, monto pendiente, exportar reporte.
- `GrossisteB2CStorefrontPage.tsx` — toggle activar tienda B2C + configuración slug/branding (al activar, se crea fila en `stores` y `sellers` con flag `is_grossiste_storefront`).
- `GrossisteProfilePage.tsx` — datos comerciales y verificación.

### 3.4 Catálogo B2B (consumidor: seller/admin)
- `src/components/b2b/ProductCardB2B.tsx`: si `owner_role = 'grossiste'`, mostrar badge "Mayorista verificado" con `business_name` y enlace a perfil del mayorista.
- `useProductsB2B.ts`: incluir `owner_user_id`, `owner_business_name` en el select y propagarlo al tipo `ProductB2BCard`.

### 3.5 Panel admin — moderación
- Nueva ruta `/admin/grossistes`:
  - Lista de mayoristas (verificación, activar/desactivar)
  - Cola de aprobación de productos pendientes (`approval_status='pending_review'`) con preview, aprobar/rechazar + nota.
  - Configurar `commission_rate` por grossiste.
  - Pantalla de liquidaciones: generar liquidación del periodo, marcar como pagada.
- En `useAdminAccounts.ts`: agregar `grossiste` a las opciones de cambio de rol; al asignarlo crear `grossiste_profiles` row (o dejar al trigger).

### 3.6 App.tsx — rutas protegidas
```tsx
<Route path="/grossiste/*" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}>...</ProtectedRoute>} />
<Route path="/admin/grossistes" element={<ProtectedRoute requiredRoles={[UserRole.ADMIN]}>...} />
```

### 3.7 i18n
Añadir claves en ES/EN/FR/HT para `grossiste.*` (sidebar, formularios, badges, toasts).

---

## 4. Detalles técnicos clave

- **Reutilización de B2B existente**: el grossiste publica al mismo `products` table → todo el motor de precios B2B (`v_productos_con_precio_b2b`, márgenes, shipping) funciona sin tocar nada del checkout.
- **Liquidaciones**: cron edge function `generate-grossiste-settlements` (semanal/mensual) que agrupa `order_items_b2b` pagados por `owner_user_id` del producto y crea filas en `grossiste_settlements`.
- **Aprobación**: nuevos productos del grossiste entran como `pending_review`; admin aprueba en `/admin/grossistes/aprobaciones`. Productos importados del admin siguen entrando como `approved`.
- **Catálogo B2C opcional**: al activar `enable_b2c_storefront`, se crea automáticamente un `store` + `seller` row vinculado al grossiste, y los sellers/admin pueden seguir comprándole en B2B (su tienda B2C es independiente).
- **Seguridad**: RLS en `products` filtra por `owner_user_id` para escritura; función security-definer `has_role` para admin override.

---

## 5. Orden de implementación

1. Migración SQL (enum, tablas, RLS, trigger, vista).
2. Tipos + auth + redirección.
3. Layout/Sidebar grossiste + Dashboard básico.
4. CRUD productos + reutilización del importador 1688/Excel.
5. Vista pedidos read-only + liquidaciones (con edge function de generación).
6. Panel admin: moderación, gestión de mayoristas, liquidaciones.
7. Toggle tienda B2C + creación automática de `store`.
8. Badges en `ProductCardB2B` + i18n.
9. QA end-to-end con un usuario de prueba.

