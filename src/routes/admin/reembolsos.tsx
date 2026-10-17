import { createFileRoute } from "@tanstack/react-router";
import AdminReembolsos from "@/pages/admin/AdminReembolsos";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/reembolsos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminReembolsos /> </ProtectedRoute>
  ),
});
