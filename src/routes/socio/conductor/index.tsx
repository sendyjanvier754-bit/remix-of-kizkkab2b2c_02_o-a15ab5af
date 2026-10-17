import { createFileRoute } from "@tanstack/react-router";
import DriverAvailableRoutesPage from "@/pages/partners/driver/DriverAvailableRoutesPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}><LazyRoute><DriverAvailableRoutesPage /></LazyRoute></ProtectedRoute>
  );
}
