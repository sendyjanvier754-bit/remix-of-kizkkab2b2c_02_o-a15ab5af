import { createFileRoute } from "@tanstack/react-router";
import AdminPartnerApplicationsPage from "@/pages/admin/AdminPartnerApplicationsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/partner-applications")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPartnerApplicationsPage /> </ProtectedRoute>
  ),
});
