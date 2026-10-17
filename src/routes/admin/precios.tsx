import { createFileRoute } from "@tanstack/react-router";
import AdminPreciosConfig from "@/pages/admin/AdminPreciosConfig";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/precios")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPreciosConfig /></LazyRoute></ProtectedRoute>
  );
}
