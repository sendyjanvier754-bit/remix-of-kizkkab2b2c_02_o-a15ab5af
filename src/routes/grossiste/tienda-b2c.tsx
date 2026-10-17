import { createFileRoute } from "@tanstack/react-router";
import GrossisteB2CStorefrontPage from "@/pages/grossiste/GrossisteB2CStorefrontPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/tienda-b2c")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><GrossisteB2CStorefrontPage /></ProtectedRoute>
  ),
});
