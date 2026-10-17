import { createFileRoute } from "@tanstack/react-router";
import GrossisteProfilePage from "@/pages/grossiste/GrossisteProfilePage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/perfil")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteProfilePage /></LazyRoute></ProtectedRoute>
  );
}
