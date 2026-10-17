import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import PurchasingAgentLogin from "@/pages/purchasing-agent/PurchasingAgentLogin";

export const Route = createFileRoute("/agente-compra/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><PurchasingAgentLogin /></LazyRoute>
  );
}
