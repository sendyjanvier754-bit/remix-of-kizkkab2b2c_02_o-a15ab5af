## Módulo de Creación de Pedidos por Agente — IMPLEMENTADO ✅

### Lo que se implementó

1. **Base de datos**: 3 tablas nuevas (`agent_sessions`, `agent_cart_drafts`, `agent_cart_draft_items`) con RLS completo + rol `sales_agent` en enum `app_role` + RPC `agent_push_cart_to_user`
2. **Edge Function**: `send-agent-otp` — genera OTP 6 dígitos, crea sesión, notifica al usuario
3. **Hooks**: `useAgentSession` (OTP + sesión) y `useAgentCartDraft` (CRUD borradores)
4. **Componentes**: AgentUserSearch, AgentOTPVerification, AgentSessionTimer, AgentDraftList, AgentProductSelector, AgentCartDraft, AgentShippingConfig
5. **Página**: `AdminAgentOrders` en `/admin/agente-pedidos` protegida para roles ADMIN, SELLER, SALES_AGENT
6. **Routing**: Ruta añadida en App.tsx con lazy loading

### Flujo
1. Agente busca usuario → solicita acceso → OTP enviado como notificación
2. Agente ingresa OTP → sesión activa 2h con timer visible
3. Agente busca productos → agrega a borrador → configura envío
4. Clic "Enviar al Checkout" → items copiados al carrito real del usuario + notificación
5. Soporte multitarea con múltiples borradores
