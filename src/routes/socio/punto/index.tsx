import { createFileRoute } from "@tanstack/react-router";
import PickupOrdersPage from "@/pages/partners/pickup/PickupOrdersPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/punto/")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.PICKUP_PARTNER, UserRole.STAFF_PICKUP, UserRole.ADMIN]}> <PickupOrdersPage /> </ProtectedRoute>
  ),
});
