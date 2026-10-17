import { createFileRoute } from "@tanstack/react-router";
import DriverRouteDetailPage from "@/pages/partners/driver/DriverRouteDetailPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/ruta/$routeId")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}> <DriverRouteDetailPage /> </ProtectedRoute>
  ),
});
