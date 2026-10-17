import { createFileRoute } from "@tanstack/react-router";
import AdminCotizaciones from "@/pages/admin/AdminCotizaciones";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/cotizaciones")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminCotizaciones /></LazyRoute></ProtectedRoute>
  );
}
