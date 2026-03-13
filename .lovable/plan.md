
## Full scope of the request

The user wants 5 things added to the `/perfil` desktop dashboard for the `user` role:

1. **Estado de devolución** — Return/refund flow across all 3 roles:
   - **User** requests a return on a delivered B2C order → **Seller** accepts/rejects, processes refund or reaches agreement → **Admin** can mediate on request
   - **Seller** requests a return on a delivered B2B order → **Admin** confirms/rejects, processes refund or agreement
2. **Mis Intereses → Favoritos inline** — Show the B2C favorites grid directly inside the `/perfil` desktop layout (right sidebar tile + dedicated inline panel) instead of just linking to `/favoritos`
3. **Servicio al Cliente → opens support menu** — In the left nav + right sidebar, "Centro de ayuda / Servicio al cliente" opens a small dropdown/popover listing options (currently only: Chat de soporte → navigates to `/soporte`)
4. **Mis Direcciones** — Render the existing `AddressesDialog` content as an inline panel in the center column when user clicks "Mis Direcciones" from the sidebar
5. **Método de Pago + Configuración** — Same pattern: clicking from sidebar renders inline panel in center column

---

## Architecture decisions

### Return status system (scope)
The system already has `useRefundManagement` hook that uses `v_refunds_management` view and `change_refund_status` RPC. **But we need a `return_requests` table** since currently refunds only attach to cancellations (via metadata), not to delivered orders. 

We need a **new DB table**: `order_return_requests`
```
id, order_id, order_type (b2b|b2c), buyer_id, seller_id, status, reason, return_reason_type, admin_notes, seller_notes, resolution (refund|exchange|credit|agreement), amount_requested, amount_approved, requested_at, reviewed_at, resolved_at, reviewed_by, created_at, updated_at
```

**Status flow:**
- B2C: `pending` → seller: `accepted` / `rejected` → if accepted: `processing` → `completed` / `agreement_reached` / admin mediates: `under_mediation` → resolution
- B2B: `pending` → admin: `accepted` / `rejected` → `processing` → `completed`

### Inline panel approach for profile sections
Instead of navigating to separate pages, each left-nav item sets an `activeSection` state in `UserProfilePage`. The center column renders the matching inline component:
- `'orders'` (default) → `<InlineOrdersPanel />`
- `'favorites'` → `<InlineFavoritesPanel />`  
- `'addresses'` → `<InlineAddressesPanel />` (reuses `useAddresses` + same form as `AddressesDialog`)
- `'payment'` → `<InlinePaymentPanel />` (shows admin-configured payment methods as read-only info for the user)
- `'settings'` → `<InlineSettingsPanel />` (change password, notifications)
- `'returns'` → `<InlineReturnsPanel />` (new component)

### Support menu
When user clicks "Centro de ayuda" → a small `Popover` opens with channel options. Currently only "Chat en vivo" (→ `/soporte`). Structured for future channels (email, phone).

---

## Files to create / edit

```text
DATABASE:
  new migration: order_return_requests table + RLS

NEW COMPONENTS:
  src/components/profile/InlineFavoritesPanel.tsx        — B2C favorites grid inline
  src/components/profile/InlineAddressesPanel.tsx        — addresses CRUD inline (reuse AddressesDialog logic)
  src/components/profile/InlinePaymentPanel.tsx          — read-only payment methods for user
  src/components/profile/InlineSettingsPanel.tsx         — change password + notifications
  src/components/profile/InlineReturnsPanel.tsx          — user's return requests list + request form
  src/components/profile/SupportMenuPopover.tsx          — popover with support channel options

NEW HOOKS:
  src/hooks/useOrderReturnRequests.ts                    — CRUD for return requests (user + seller + admin views)

EDIT:
  src/pages/UserProfilePage.tsx                         — add activeSection state, render inline panels, support popover, update nav
  src/pages/seller/SellerMisComprasPage.tsx             — add "Solicitar Devolución" button on delivered B2B orders + handle return status
  src/pages/seller/SellerPedidosPage.tsx                — add "Gestionar Devolución" section for incoming B2C return requests from users
  src/pages/admin/AdminReembolsos.tsx                   — add return_requests tab alongside existing refunds
```

---

## Return flow detail per role

### User (B2C order, delivered)
- In `InlineOrdersPanel` order detail: when `status === 'delivered'`, show **"Solicitar Devolución"** button
- Opens `ReturnRequestDialog`: select reason (product damaged, wrong item, not as described, etc.), describe, enter amount requested
- Creates row in `order_return_requests` with `order_type='b2c'`, `status='pending'`
- Status badge visible in order card: `"Devolución: Pendiente/Aceptada/Rechazada"`

### Seller (receives B2C return request)
- In `SellerPedidosPage`: new tab **"Devoluciones"** showing incoming return requests
- Can: Accept → prompts refund amount + method, or "Acuerdo" text → sets `status='agreement_reached'`
- Can: Reject → requires reason
- Can: Escalate to admin mediation → sets `status='under_mediation'`

### Seller (B2B order, delivered — seller bought from catalog)
- In `SellerMisComprasPage` order detail: **"Solicitar Devolución"** button on delivered orders
- Creates `order_return_requests` with `order_type='b2b'`, pending admin review

### Admin
- In `AdminReembolsos` page: new tab **"Solicitudes de Devolución"** 
- Can accept/reject B2B return requests (seller requests)
- Can mediate B2C disputes (when seller escalated or user requested admin)

---

## DB schema (new table)

```sql
CREATE TABLE public.order_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('b2b', 'b2c')),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','processing','completed','agreement_reached','under_mediation','cancelled')),
  reason TEXT NOT NULL,
  reason_type TEXT,
  amount_requested NUMERIC(10,2),
  amount_approved NUMERIC(10,2),
  resolution_type TEXT CHECK (resolution_type IN ('refund','exchange','store_credit','agreement')),
  seller_notes TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_return_requests ENABLE ROW LEVEL SECURITY;

-- User can see and create their own
CREATE POLICY "users_own_returns" ON public.order_return_requests
  FOR ALL TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- Seller can see returns for their orders
CREATE POLICY "seller_view_returns" ON public.order_return_requests
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

-- Seller can update (accept/reject) returns where they are seller
CREATE POLICY "seller_update_returns" ON public.order_return_requests
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Admin can do everything (using has_role from profiles)
CREATE POLICY "admin_all_returns" ON public.order_return_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
```

---

## UserProfilePage navigation redesign

```text
LEFT SIDEBAR active section logic:
  "Ver todos" (Mis Pedidos)  → activeSection = 'orders'
  "Favoritos" (Mis Intereses) → activeSection = 'favorites'   ← NEW inline
  "Mis Direcciones"           → activeSection = 'addresses'   ← NEW inline
  "Métodos de pago"           → activeSection = 'payment'     ← NEW inline
  "Configuración"             → activeSection = 'settings'    ← NEW inline
  "Mis Devoluciones"          → activeSection = 'returns'     ← NEW inline + NEW nav item
  "Centro de ayuda"           → opens SupportMenuPopover      ← NEW popover
  (no longer navigate away)
```

The center main column shows `<InlineOrdersPanel />` by default and swaps to the active section component. The greeting card + stats bar stays pinned at the top always.

Right sidebar "Favoritos" tile will show a mini grid (3 images + count) + "Ver todos" → sets `activeSection='favorites'`.
