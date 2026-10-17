import { createFileRoute } from "@tanstack/react-router";
import DriverRouteDetailPage from "@/pages/partners/driver/DriverRouteDetailPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/ruta/$routeId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}><LazyRoute><DriverRouteDetailPage /></LazyRoute></ProtectedRoute>
  );
}
