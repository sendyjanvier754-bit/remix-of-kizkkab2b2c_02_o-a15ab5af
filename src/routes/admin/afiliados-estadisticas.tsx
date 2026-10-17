import { createFileRoute } from "@tanstack/react-router";
import AdminAffiliateStatsPage from "@/pages/admin/AdminAffiliateStatsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/afiliados-estadisticas")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminAffiliateStatsPage /> </ProtectedRoute>
  ),
});
