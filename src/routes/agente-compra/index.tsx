import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PurchasingAgentDashboard from "@/pages/purchasing-agent/PurchasingAgentDashboard";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/agente-compra/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.PURCHASING_AGENT, UserRole.ADMIN]}><LazyRoute><PurchasingAgentDashboard /></LazyRoute></ProtectedRoute>
  );
}
