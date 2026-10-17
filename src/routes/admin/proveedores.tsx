import { createFileRoute } from "@tanstack/react-router";
import AdminProveedores from "@/pages/admin/AdminProveedores";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/proveedores")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminProveedores /> </ProtectedRoute>
  ),
});
