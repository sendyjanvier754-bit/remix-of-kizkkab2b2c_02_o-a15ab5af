import { createFileRoute } from "@tanstack/react-router";
import AdminAffiliatesPage from "@/pages/admin/AdminAffiliatesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/affiliates")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminAffiliatesPage /> </ProtectedRoute>
  ),
});
