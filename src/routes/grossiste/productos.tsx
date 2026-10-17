import { createFileRoute } from "@tanstack/react-router";
import GrossisteProductsPage from "@/pages/grossiste/GrossisteProductsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/productos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><GrossisteProductsPage /></ProtectedRoute>
  ),
});
