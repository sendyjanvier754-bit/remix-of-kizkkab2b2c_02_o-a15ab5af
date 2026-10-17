import { createFileRoute } from "@tanstack/react-router";
import AdminBrandingPage from "@/pages/admin/AdminBrandingPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/branding")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminBrandingPage /> </ProtectedRoute>
  ),
});
