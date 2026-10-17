import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import PickupOrdersPage from "@/pages/partners/pickup/PickupOrdersPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/punto/historial")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.PICKUP_PARTNER, UserRole.STAFF_PICKUP, UserRole.ADMIN]}><LazyRoute><PickupOrdersPage historyMode /></LazyRoute></ProtectedRoute>
  );
}
