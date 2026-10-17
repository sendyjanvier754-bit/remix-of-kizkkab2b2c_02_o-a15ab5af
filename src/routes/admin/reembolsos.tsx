import { createFileRoute } from "@tanstack/react-router";
import AdminReembolsos from "@/pages/admin/AdminReembolsos";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/reembolsos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminReembolsos /></LazyRoute></ProtectedRoute>
  );
}
