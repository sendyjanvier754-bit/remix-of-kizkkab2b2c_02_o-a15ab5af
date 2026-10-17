import { createFileRoute } from "@tanstack/react-router";
import AdminCatalogo from "@/pages/admin/AdminCatalogo";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/catalogo/")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminCatalogo /> </ProtectedRoute>
  ),
});
