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

## Fix PO Linking — Close Expired PO on New Order — IMPLEMENTADO ✅

### Problema
El trigger `check_po_auto_close_thresholds` evaluaba tiempo Y cantidad en cada actualización de totales. Cuando un pedido se vinculaba a una PO vencida por tiempo, la actualización de totales disparaba el auto-cierre en la misma transacción — el pedido quedaba atrapado en una PO cerrada.

### Cambios realizados

1. **`link_order_to_market_po_on_payment`**: Ahora verifica si la PO abierta está vencida por `time_interval_hours` ANTES de vincular. Si está vencida → cierra la PO (con sus pedidos existentes intactos) → abre nueva PO → vincula el pedido nuevo a la PO fresca.

2. **`check_po_auto_close_thresholds`**: Se eliminó el chequeo de tiempo. Solo evalúa `quantity_threshold`. El cierre por tiempo ahora se maneja exclusivamente en el paso 1 (al llegar un nuevo pedido).

3. **Data fix**: Pedido `90a31c1f` ($381.61) movido de PO-CB-004 (cerrada) a PO-CB-005 (activa). Totales recalculados.

### Flujo corregido
```
Pedido 1 llega → PO-001 abierta, no vencida → vincula a PO-001 ✓
Pedido 2 llega → PO-001 abierta, no vencida → vincula a PO-001 ✓
... pasa el tiempo, PO-001 vence ...
Pedido 3 llega → PO-001 abierta PERO vencida → cierra PO-001 (mantiene pedidos 1-2) → abre PO-002 → vincula pedido 3 a PO-002 ✓
Pedido 4 llega → PO-002 abierta, no vencida → vincula a PO-002 ✓
```
