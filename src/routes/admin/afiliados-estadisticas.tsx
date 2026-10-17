import { createFileRoute } from "@tanstack/react-router";
import AdminAffiliateStatsPage from "@/pages/admin/AdminAffiliateStatsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/afiliados-estadisticas")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminAffiliateStatsPage /></LazyRoute></ProtectedRoute>
  );
}
