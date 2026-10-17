import { createFileRoute } from "@tanstack/react-router";
import AdminMarketplaceSections from "@/pages/admin/AdminMarketplaceSections";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/marketplace-sections")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminMarketplaceSections /> </ProtectedRoute>
  ),
});
