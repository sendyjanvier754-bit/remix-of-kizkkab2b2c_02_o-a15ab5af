import { createFileRoute } from "@tanstack/react-router";
import AdminAgentOrders from "@/pages/admin/AdminAgentOrders";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/agente-pedidos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}><LazyRoute><AdminAgentOrders /></LazyRoute></ProtectedRoute>
  );
}
