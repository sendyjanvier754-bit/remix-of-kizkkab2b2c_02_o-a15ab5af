import { createFileRoute } from "@tanstack/react-router";
import AdminPurchasingAgentsPage from "@/pages/admin/AdminPurchasingAgentsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/purchasing-agents")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPurchasingAgentsPage /> </ProtectedRoute>
  ),
});
