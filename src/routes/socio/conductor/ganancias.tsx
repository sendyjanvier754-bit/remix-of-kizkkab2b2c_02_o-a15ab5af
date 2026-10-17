import { createFileRoute } from "@tanstack/react-router";
import PartnerEarningsPage from "@/pages/partners/PartnerEarningsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/ganancias")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}> <PartnerEarningsPage variant="driver" /> </ProtectedRoute>
  ),
});
