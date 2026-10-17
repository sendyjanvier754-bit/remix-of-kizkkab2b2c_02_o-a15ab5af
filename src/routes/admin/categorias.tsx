import { createFileRoute } from "@tanstack/react-router";
import AdminCategorias from "@/pages/admin/AdminCategorias";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/categorias")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminCategorias /> </ProtectedRoute>
  ),
});
