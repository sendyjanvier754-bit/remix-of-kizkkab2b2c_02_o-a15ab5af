import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import PartnerEarningsPage from "@/pages/partners/PartnerEarningsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/ganancias")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}><LazyRoute><PartnerEarningsPage variant="driver" /></LazyRoute></ProtectedRoute>
  );
}
