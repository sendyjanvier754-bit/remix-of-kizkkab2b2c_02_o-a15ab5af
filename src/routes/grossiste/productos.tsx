import { createFileRoute } from "@tanstack/react-router";
import GrossisteProductsPage from "@/pages/grossiste/GrossisteProductsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/productos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteProductsPage /></LazyRoute></ProtectedRoute>
  );
}
