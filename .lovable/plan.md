## Plan: Pago con Tarjetas + UI Admin de Keys + Rediseño Checkout B2C

### 1. Base de datos: tabla `stripe_settings`
Nueva tabla con una sola fila activa (UNIQUE en `is_active=true`):
- `publishable_key` (text, visible al frontend al estar activa)
- `secret_key_encrypted` (text, leído solo por edge functions con service_role)
- `webhook_secret_encrypted` (text, igual)
- `mode` ('test' | 'live')
- `is_active`, `updated_by`, timestamps

RLS:
- SELECT solo admins (vía `has_role`)
- INSERT/UPDATE/DELETE solo admins
- Edge functions leen con `service_role` (bypass RLS)

GRANT a `authenticated` y `service_role` (no `anon`).

Aviso de seguridad: las keys sk_live viven en una tabla. Cualquier admin comprometido las puede ver. Recomiendo restringir el rol admin estrictamente.

### 2. UI Admin de Keys
Nueva página `src/pages/admin/AdminPaymentKeys.tsx`:
- Formulario con: modo (test/live), publishable_key, secret_key, webhook_secret
- Las secret/webhook se muestran enmascaradas (`sk_live_••••1234`) tras guardar
- Botón "Probar conexión" que llama edge function `stripe-test-connection`
- Sección con la URL del webhook a copiar:
  `https://fonvunyiaxcjkodrnpox.supabase.co/functions/v1/stripe-webhook`
- Lista de eventos a habilitar en Stripe Dashboard: `payment_intent.succeeded`, `payment_intent.payment_failed`

Ruta añadida en `App.tsx` con guard de admin.

### 3. Edge Functions
Todas leen keys desde la tabla `stripe_settings` (where `is_active=true`) usando service_role.

- **`create-payment-intent`** (verify_jwt = false, valida JWT en código)
  - Input: `{ order_id, order_type: 'b2b'|'b2c', amount, currency }`
  - Verifica que el order pertenece al user (RLS check vía cliente con anon + JWT del header)
  - Crea PaymentIntent con `metadata: { order_id, order_type }`
  - Devuelve `client_secret` + `publishable_key`

- **`stripe-webhook`** (verify_jwt = false, público)
  - Verifica firma con `webhook_secret`
  - En `payment_intent.succeeded`: actualiza `orders_b2b` o `orders_b2c` (según metadata) → `payment_status='paid'`, `status='paid'`
  - En `payment_intent.payment_failed`: marca `payment_status='failed'`

- **`stripe-test-connection`** (verify_jwt = false, admin-only en código)
  - Hace `stripe.balance.retrieve()` para validar la secret key
  - Devuelve `{ ok: true, mode, account_id }` o error

### 4. Componente `<StripeCardForm />`
`src/components/payments/StripeCardForm.tsx`:
- Usa `@stripe/stripe-js` + `@stripe/react-stripe-js` (ya o por instalar)
- Props: `orderId`, `orderType`, `amount`, `onSuccess`, `onError`
- Flujo: pide client_secret a `create-payment-intent` → `stripe.confirmCardPayment(...)`
- Muestra spinner; al confirmar, llama `onSuccess()` que cambia el order a `pending_validation` (la confirmación final llega vía webhook)

Hook `usePublicStripeKey()` que lee la `publishable_key` activa (consulta pública limitada vía vista o RPC `get_active_stripe_publishable_key`).

### 5. Integración en checkouts
- **`SellerCheckout.tsx`** (B2B): donde detecta `paymentMethod === 'tarjeta'`, renderiza `<StripeCardForm>` en vez de confirmar el pedido inmediatamente. El pedido se crea como `pending_payment` antes de mostrar el form.
- **`CheckoutPage.tsx`** (B2C): mismo flujo.

Comportamiento corregido: ya no se marca "pedido confirmado" al iniciar — queda en `pending_payment` hasta que el webhook reciba `payment_intent.succeeded`.

### 6. Rediseño visual `CheckoutPage.tsx` (B2C)
Solo presentación, sin tocar lógica de carga, splits por tienda, ni métodos por país.

Replicar el layout de `SellerCheckout` (según las capturas):
- Header chip "Checkout B2C" + badge "N productos"
- Grid 2 columnas en desktop: izquierda secciones, derecha resumen sticky
- Cards uniformes con título e iconos lucide:
  - Dirección (con botón editar)
  - "Opción de Entrega" (Domicilio / Punto de Retiro)
  - "Tipo de Envío" (Express / Estándar con badges)
  - "Productos (N)" (lista compacta)
  - "Forma de pago" (Tarjeta / MonCash / Transferencia)
- Resumen lateral: Subtotal, Logística, ETA, código descuento, Total a Pagar, botón "Confirmar Pedido"
- Mobile: cards apiladas, resumen al final con CTA fijo abajo

Reutilizo `B2BOrderSummary` solo como referencia de estilos; creo `B2COrderSummary` análogo para no mezclar tipos.

### 7. Archivos
**Nuevos**
- `supabase/migrations/<timestamp>_stripe_settings.sql`
- `supabase/functions/create-payment-intent/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/stripe-test-connection/index.ts`
- `src/pages/admin/AdminPaymentKeys.tsx`
- `src/components/payments/StripeCardForm.tsx`
- `src/components/payments/StripeProvider.tsx`
- `src/hooks/useStripeSettings.ts`
- `src/components/checkout/B2COrderSummary.tsx`

**Editados**
- `src/App.tsx` (ruta admin)
- `src/pages/admin/<sidebar>` (link a Payment Keys)
- `src/pages/CheckoutPage.tsx` (rediseño + integración tarjeta)
- `src/pages/seller/SellerCheckout.tsx` (integración tarjeta)
- `package.json` (`@stripe/stripe-js`, `@stripe/react-stripe-js`)

### 8. Configuración Stripe (instrucciones para ti)
Tras desplegar, debes:
1. Ir a /admin/payment-keys, pegar pk + sk + mode
2. Stripe Dashboard → Webhooks → Add endpoint con la URL del webhook + eventos
3. Copiar el "Signing secret" del webhook y pegarlo en /admin/payment-keys
4. Click "Probar conexión" para validar

---

¿Procedo con todo el plan? Es grande (~9 archivos nuevos, 4 editados, migración + 3 edge functions).