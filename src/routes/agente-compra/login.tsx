import { createFileRoute } from "@tanstack/react-router";
import PurchasingAgentLogin from "@/pages/purchasing-agent/PurchasingAgentLogin";

export const Route = createFileRoute("/agente-compra/login")({
  component: PurchasingAgentLogin,
});
