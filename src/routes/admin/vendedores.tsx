import { createFileRoute } from "@tanstack/react-router";
import AdminVendedores from "@/pages/admin/AdminVendedores";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/vendedores")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminVendedores /> </ProtectedRoute>
  ),
});
