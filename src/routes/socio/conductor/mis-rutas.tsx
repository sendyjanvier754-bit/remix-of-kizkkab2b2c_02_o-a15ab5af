import { createFileRoute } from "@tanstack/react-router";
import DriverMyRoutesPage from "@/pages/partners/driver/DriverMyRoutesPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/mis-rutas")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}><LazyRoute><DriverMyRoutesPage /></LazyRoute></ProtectedRoute>
  );
}
