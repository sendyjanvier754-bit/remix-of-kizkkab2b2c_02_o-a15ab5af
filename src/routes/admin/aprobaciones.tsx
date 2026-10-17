import { createFileRoute } from "@tanstack/react-router";
import AdminApprovals from "@/pages/admin/AdminApprovals";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/aprobaciones")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminApprovals /></LazyRoute></ProtectedRoute>
  );
}
