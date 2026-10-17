import { createFileRoute } from "@tanstack/react-router";
import AdminCatalogo from "@/pages/admin/AdminCatalogo";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/catalogo/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminCatalogo /></LazyRoute></ProtectedRoute>
  );
}
