import { createFileRoute } from "@tanstack/react-router";
import AdminPickupPointsPage from "@/pages/admin/AdminPickupPointsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/pickup-points")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPickupPointsPage /> </ProtectedRoute>
  ),
});
