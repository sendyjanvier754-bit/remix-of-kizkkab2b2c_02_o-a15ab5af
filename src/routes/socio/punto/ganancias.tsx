import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import PartnerEarningsPage from "@/pages/partners/PartnerEarningsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/punto/ganancias")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.PICKUP_PARTNER, UserRole.STAFF_PICKUP, UserRole.ADMIN]}><LazyRoute><PartnerEarningsPage variant="pickup" /></LazyRoute></ProtectedRoute>
  );
}
