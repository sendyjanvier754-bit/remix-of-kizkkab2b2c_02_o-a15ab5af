import { createFileRoute } from "@tanstack/react-router";
import AdminPedidos from "@/pages/admin/AdminPedidos";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/pedidos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPedidos /> </ProtectedRoute>
  ),
});
