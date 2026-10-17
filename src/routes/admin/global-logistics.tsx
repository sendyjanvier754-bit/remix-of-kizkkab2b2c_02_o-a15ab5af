import { createFileRoute } from "@tanstack/react-router";
import AdminGlobalLogisticsPage from "@/pages/admin/AdminGlobalLogisticsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/global-logistics")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminGlobalLogisticsPage /></LazyRoute></ProtectedRoute>
  );
}
