import { createFileRoute } from "@tanstack/react-router";
import GrossisteDashboard from "@/pages/grossiste/GrossisteDashboard";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteDashboard /></LazyRoute></ProtectedRoute>
  );
}
