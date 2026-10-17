import { createFileRoute } from "@tanstack/react-router";
import AdminAgentOrders from "@/pages/admin/AdminAgentOrders";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/agente-pedidos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}> <AdminAgentOrders /> </ProtectedRoute>
  ),
});
