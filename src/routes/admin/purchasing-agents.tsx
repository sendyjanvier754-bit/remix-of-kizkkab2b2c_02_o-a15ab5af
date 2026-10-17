import { createFileRoute } from "@tanstack/react-router";
import AdminPurchasingAgentsPage from "@/pages/admin/AdminPurchasingAgentsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/purchasing-agents")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPurchasingAgentsPage /></LazyRoute></ProtectedRoute>
  );
}
