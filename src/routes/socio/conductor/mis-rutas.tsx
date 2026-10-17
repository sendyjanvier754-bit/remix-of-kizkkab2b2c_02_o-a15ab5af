import { createFileRoute } from "@tanstack/react-router";
import DriverMyRoutesPage from "@/pages/partners/driver/DriverMyRoutesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/mis-rutas")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}> <DriverMyRoutesPage /> </ProtectedRoute>
  ),
});
