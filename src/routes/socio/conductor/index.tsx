import { createFileRoute } from "@tanstack/react-router";
import DriverAvailableRoutesPage from "@/pages/partners/driver/DriverAvailableRoutesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/conductor/")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}> <DriverAvailableRoutesPage /> </ProtectedRoute>
  ),
});
