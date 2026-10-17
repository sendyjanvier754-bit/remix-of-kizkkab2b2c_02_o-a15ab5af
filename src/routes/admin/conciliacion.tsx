import { createFileRoute } from "@tanstack/react-router";
import AdminConciliacion from "@/pages/admin/AdminConciliacion";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/conciliacion")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminConciliacion /> </ProtectedRoute>
  ),
});
