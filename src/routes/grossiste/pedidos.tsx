import { createFileRoute } from "@tanstack/react-router";
import GrossisteOrdersPage from "@/pages/grossiste/GrossisteOrdersPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/pedidos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><GrossisteOrdersPage /></ProtectedRoute>
  ),
});
