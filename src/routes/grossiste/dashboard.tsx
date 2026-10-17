import { createFileRoute } from "@tanstack/react-router";
import GrossisteDashboard from "@/pages/grossiste/GrossisteDashboard";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/dashboard")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><GrossisteDashboard /></ProtectedRoute>
  ),
});
