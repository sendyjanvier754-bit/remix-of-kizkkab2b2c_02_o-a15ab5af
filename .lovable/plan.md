## Plan: Módulo de Creación de Pedidos por Agente

### Resumen

Sistema que permite a admin/seller/agente de venta (crea el rol de agente de venta) armar el carrito de un usuario de forma remota, con autenticación delegada vía OTP, interfaz espejo del módulo de Adquisición de Lotes, soporte multitarea con borradores, y configuración de envío en nombre del usuario.

---

### 1. Esquema de Base de Datos (Migración SQL)

**Nueva tabla `agent_sessions**` — sesiones de asistencia remota:

```sql
CREATE TABLE public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  session_expires_at TIMESTAMPTZ, -- set on verification (e.g. +2h)
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification','active','expired','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
```

**Nueva tabla `agent_cart_drafts**` — borradores de carritos creados por agentes:

```sql
CREATE TABLE public.agent_cart_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_session_id UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Borrador',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent_to_checkout','completed','cancelled')),
  shipping_address JSONB,
  market_country TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.agent_cart_drafts ENABLE ROW LEVEL SECURITY;
```

**Nueva tabla `agent_cart_draft_items**` — items de cada borrador:

```sql
CREATE TABLE public.agent_cart_draft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.agent_cart_drafts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  variant_id UUID,
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_price NUMERIC(12,2) NOT NULL,
  peso_kg NUMERIC(10,4) DEFAULT 0,
  color TEXT,
  size TEXT,
  moq INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.agent_cart_draft_items ENABLE ROW LEVEL SECURITY;
```

**RLS Policies**: Admin/seller can CRUD their own sessions and drafts via `has_role()`. Target users can read drafts where `target_user_id = auth.uid()`.

**Edge Function `send-agent-otp**`: Genera código 6 dígitos, lo almacena en `agent_sessions`, envía notificación al usuario (tabla `notifications` + email vía Supabase).

**DB Function `agent_push_cart_to_user**`: Cuando el agente hace "Enviar al Checkout", copia los items del borrador al carrito real (`b2b_carts`/`b2b_cart_items`) del usuario objetivo, actualiza la dirección de envío, y crea una notificación.

---

### 2. Flujo de Autenticación Delegada

1. Agente navega a `/admin/agente-pedidos` (o `/seller/agente-pedidos`)
2. Busca/selecciona un usuario de la tabla `profiles` (autocomplete por nombre/email/código)
3. Clic en "Solicitar Acceso" → llama edge function `send-agent-otp`
4. Edge function genera código 6 dígitos, guarda en `agent_sessions`, inserta notificación al usuario
5. Agente ingresa el código → se valida contra `agent_sessions` → si correcto, `status = 'active'`, `session_expires_at = NOW() + 2h`
6. Timer visible en la UI mostrando tiempo restante de sesión

---

### 3. Archivos a Crear


| Archivo                                         | Propósito                                             |
| ----------------------------------------------- | ----------------------------------------------------- |
| `src/pages/admin/AdminAgentOrders.tsx`          | Página principal del módulo                           |
| `src/components/agent/AgentUserSearch.tsx`      | Buscador/selector de usuarios                         |
| `src/components/agent/AgentOTPVerification.tsx` | Input OTP 6 dígitos (reutiliza `InputOTP`)            |
| `src/components/agent/AgentSessionTimer.tsx`    | Timer de sesión activa                                |
| `src/components/agent/AgentDraftList.tsx`       | Lista de borradores activos (multitarea)              |
| `src/components/agent/AgentProductSelector.tsx` | Espejo de `SellerAcquisicionLotes` adaptado           |
| `src/components/agent/AgentCartDraft.tsx`       | Vista del borrador actual con items                   |
| `src/components/agent/AgentShippingConfig.tsx`  | Selector de dirección/país/departamento/comuna        |
| `src/components/agent/AgentCheckoutConfirm.tsx` | Resumen final + botón "Enviar al Checkout"            |
| `src/hooks/useAgentSession.ts`                  | Lógica de sesión delegada (crear, verificar, expirar) |
| `src/hooks/useAgentCartDraft.ts`                | CRUD de borradores y sus items                        |
| `supabase/functions/send-agent-otp/index.ts`    | Edge function para enviar OTP                         |


---

### 4. Interfaz de Selección de Productos

- Reutiliza los componentes `ProductCardB2B`, `FeaturedProductsCarousel`, y el hook `useProductsB2B` existentes
- El `AgentProductSelector` wrappea la misma UI de Adquisición de Lotes pero en vez de usar `useB2BCartSupabase`, inserta directamente en `agent_cart_draft_items` con el `draft_id` activo
- Precios se obtienen de `v_productos_con_precio_b2b` respetando el mercado seleccionado

---

### 5. Gestión Multitarea

- `AgentDraftList` muestra tabs/cards con cada borrador abierto (draft status)
- Cada borrador tiene: label editable, usuario target, cantidad de items, subtotal
- El agente puede cambiar entre borradores sin perder estado
- "Guardar Borrador" es automático (cada operación persiste en DB)

---

### 6. Checkout y Notificación

1. Agente configura dirección vía `AgentShippingConfig` (usa `useCountriesRoutes` + selector departamento/comuna existentes)
2. Dirección se guarda en `agent_cart_drafts.shipping_address`
3. Clic "Confirmar y Enviar al Checkout":
  - Llama RPC `agent_push_cart_to_user` que copia items al carrito real del usuario
  - Inserta notificación: "Tu carrito ha sido preparado. Revisa y procede al pago"
  - Draft status → `sent_to_checkout`
4. El usuario al entrar ve su carrito lleno y la dirección preconfigurada
5. El usuario puede modificar/eliminar items libremente (usa su propio `useB2BCartSupabase`)

---

### 7. Ruta y Navegación

- Agregar ruta `/admin/agente-pedidos` en `App.tsx` protegida con roles `[ADMIN, SELLER]`
- Agregar enlace en el menú lateral de admin

---

### 8. Seguridad

- OTP expira en 10 minutos, sesión activa en 2 horas
- Cada operación de escritura en draft valida que la sesión esté activa y no expirada
- RLS en todas las tablas nuevas
- El agente NO inicia sesión como el usuario — solo escribe en tablas intermedias
- El usuario mantiene control total de su carrito final