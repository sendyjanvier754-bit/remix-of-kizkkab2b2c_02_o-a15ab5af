import { createFileRoute } from "@tanstack/react-router";
import AdminVendedores from "@/pages/admin/AdminVendedores";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/vendedores")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminVendedores /></LazyRoute></ProtectedRoute>
  );
}
