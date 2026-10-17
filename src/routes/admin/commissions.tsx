import { createFileRoute } from "@tanstack/react-router";
import AdminCommissionPage from "@/pages/admin/AdminCommissionPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/commissions")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminCommissionPage /></LazyRoute></ProtectedRoute>
  );
}
