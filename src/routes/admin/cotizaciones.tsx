import { createFileRoute } from "@tanstack/react-router";
import AdminCotizaciones from "@/pages/admin/AdminCotizaciones";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/cotizaciones")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminCotizaciones /> </ProtectedRoute>
  ),
});
