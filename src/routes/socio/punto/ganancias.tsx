import { createFileRoute } from "@tanstack/react-router";
import PartnerEarningsPage from "@/pages/partners/PartnerEarningsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/punto/ganancias")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.PICKUP_PARTNER, UserRole.STAFF_PICKUP, UserRole.ADMIN]}> <PartnerEarningsPage variant="pickup" /> </ProtectedRoute>
  ),
});
