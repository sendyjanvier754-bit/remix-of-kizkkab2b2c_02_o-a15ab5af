import { createFileRoute } from "@tanstack/react-router";
import AdminBanners from "@/pages/admin/AdminBanners";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/banners")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminBanners /> </ProtectedRoute>
  ),
});
