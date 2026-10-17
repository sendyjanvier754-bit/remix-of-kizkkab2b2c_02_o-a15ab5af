import { createFileRoute } from "@tanstack/react-router";
import AdminUserDiscounts from "@/pages/admin/AdminUserDiscounts";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/descuentos-usuarios")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminUserDiscounts /></LazyRoute></ProtectedRoute>
  );
}
