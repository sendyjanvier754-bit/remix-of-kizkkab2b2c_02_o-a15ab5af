import { createFileRoute } from "@tanstack/react-router";
import AdminEmailConfigPage from "@/pages/admin/AdminEmailConfigPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/email-config")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminEmailConfigPage /> </ProtectedRoute>
  ),
});
