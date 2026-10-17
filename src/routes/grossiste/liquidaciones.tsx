import { createFileRoute } from "@tanstack/react-router";
import GrossisteSettlementsPage from "@/pages/grossiste/GrossisteSettlementsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/liquidaciones")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteSettlementsPage /></LazyRoute></ProtectedRoute>
  );
}
