import { createFileRoute } from "@tanstack/react-router";
import AdminApprovals from "@/pages/admin/AdminApprovals";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/aprobaciones")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminApprovals /> </ProtectedRoute>
  ),
});
