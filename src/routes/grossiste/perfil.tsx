import { createFileRoute } from "@tanstack/react-router";
import GrossisteProfilePage from "@/pages/grossiste/GrossisteProfilePage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/perfil")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><GrossisteProfilePage /></ProtectedRoute>
  ),
});
