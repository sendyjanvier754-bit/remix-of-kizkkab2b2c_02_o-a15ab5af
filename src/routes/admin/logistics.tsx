import { createFileRoute } from "@tanstack/react-router";
import AdminLogisticsPage from "@/pages/admin/AdminLogisticsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/logistics")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminLogisticsPage /> </ProtectedRoute>
  ),
});
