import { createFileRoute } from "@tanstack/react-router";
import AdminEmailTemplatesPage from "@/pages/admin/AdminEmailTemplatesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/email-templates")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminEmailTemplatesPage /> </ProtectedRoute>
  ),
});
