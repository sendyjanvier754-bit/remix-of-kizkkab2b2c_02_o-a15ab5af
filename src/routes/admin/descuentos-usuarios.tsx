import { createFileRoute } from "@tanstack/react-router";
import AdminUserDiscounts from "@/pages/admin/AdminUserDiscounts";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/descuentos-usuarios")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminUserDiscounts /> </ProtectedRoute>
  ),
});
