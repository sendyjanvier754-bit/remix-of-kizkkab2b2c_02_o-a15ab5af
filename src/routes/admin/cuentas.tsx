import { createFileRoute } from "@tanstack/react-router";
import AdminAccountsPage from "@/pages/admin/AdminAccountsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/cuentas")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminAccountsPage /> </ProtectedRoute>
  ),
});
