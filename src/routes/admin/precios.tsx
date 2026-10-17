import { createFileRoute } from "@tanstack/react-router";
import AdminPreciosConfig from "@/pages/admin/AdminPreciosConfig";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/precios")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPreciosConfig /> </ProtectedRoute>
  ),
});
