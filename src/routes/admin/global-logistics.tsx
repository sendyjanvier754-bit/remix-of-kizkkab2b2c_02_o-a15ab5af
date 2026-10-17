import { createFileRoute } from "@tanstack/react-router";
import AdminGlobalLogisticsPage from "@/pages/admin/AdminGlobalLogisticsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/global-logistics")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminGlobalLogisticsPage /> </ProtectedRoute>
  ),
});
