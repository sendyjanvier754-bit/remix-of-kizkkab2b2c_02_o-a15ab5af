import { createFileRoute } from "@tanstack/react-router";
import AdminLogisticsPage from "@/pages/admin/AdminLogisticsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/logistics")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminLogisticsPage /></LazyRoute></ProtectedRoute>
  );
}
