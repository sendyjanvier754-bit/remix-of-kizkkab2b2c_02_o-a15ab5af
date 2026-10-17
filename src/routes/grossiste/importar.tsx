import { createFileRoute } from "@tanstack/react-router";
import GrossisteImportPage from "@/pages/grossiste/GrossisteImportPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/importar")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><GrossisteImportPage /></ProtectedRoute>
  ),
});
