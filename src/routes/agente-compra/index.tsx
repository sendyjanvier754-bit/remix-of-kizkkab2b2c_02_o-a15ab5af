import { createFileRoute } from "@tanstack/react-router";
import PurchasingAgentDashboard from "@/pages/purchasing-agent/PurchasingAgentDashboard";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/agente-compra/")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.PURCHASING_AGENT, UserRole.ADMIN]}> <PurchasingAgentDashboard /> </ProtectedRoute>
  ),
});
