import { createFileRoute } from "@tanstack/react-router";
import AdminTransitHubsPage from "@/pages/admin/AdminTransitHubsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/transit-hubs")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminTransitHubsPage /> </ProtectedRoute>
  ),
});
