import { createFileRoute } from "@tanstack/react-router";
import AdminAccountsPage from "@/pages/admin/AdminAccountsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/cuentas")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminAccountsPage /></LazyRoute></ProtectedRoute>
  );
}
