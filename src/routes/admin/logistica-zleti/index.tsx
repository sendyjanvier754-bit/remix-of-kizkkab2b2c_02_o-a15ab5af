import { createFileRoute } from "@tanstack/react-router";
import AdminZletiLogisticsPage from "@/pages/admin/AdminZletiLogisticsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/logistica-zleti/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminZletiLogisticsPage /></LazyRoute></ProtectedRoute>
  );
}
