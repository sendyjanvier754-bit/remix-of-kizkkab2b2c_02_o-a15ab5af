import { createFileRoute } from "@tanstack/react-router";
import GrossisteOrdersPage from "@/pages/grossiste/GrossisteOrdersPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/pedidos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteOrdersPage /></LazyRoute></ProtectedRoute>
  );
}
