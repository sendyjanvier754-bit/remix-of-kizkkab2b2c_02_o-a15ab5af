import { createFileRoute } from "@tanstack/react-router";
import AdminB2BSyncPage from "@/pages/admin/AdminB2BSyncPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/b2b-sync")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminB2BSyncPage /> </ProtectedRoute>
  ),
});
