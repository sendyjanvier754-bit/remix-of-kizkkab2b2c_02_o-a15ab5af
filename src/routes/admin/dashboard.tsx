import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/dashboard")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminDashboard /> </ProtectedRoute>
  ),
});
