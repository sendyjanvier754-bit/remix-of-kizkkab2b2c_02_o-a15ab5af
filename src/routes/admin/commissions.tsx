import { createFileRoute } from "@tanstack/react-router";
import AdminCommissionPage from "@/pages/admin/AdminCommissionPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/commissions")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminCommissionPage /> </ProtectedRoute>
  ),
});
