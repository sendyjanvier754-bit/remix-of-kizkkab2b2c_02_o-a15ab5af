import { createFileRoute } from "@tanstack/react-router";
import GrossisteSettlementsPage from "@/pages/grossiste/GrossisteSettlementsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/liquidaciones")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><GrossisteSettlementsPage /></ProtectedRoute>
  ),
});
