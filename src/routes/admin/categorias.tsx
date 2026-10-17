import { createFileRoute } from "@tanstack/react-router";
import AdminCategorias from "@/pages/admin/AdminCategorias";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/categorias")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminCategorias /></LazyRoute></ProtectedRoute>
  );
}
