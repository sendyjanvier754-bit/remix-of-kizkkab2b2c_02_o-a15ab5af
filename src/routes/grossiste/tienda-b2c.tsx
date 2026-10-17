import { createFileRoute } from "@tanstack/react-router";
import GrossisteB2CStorefrontPage from "@/pages/grossiste/GrossisteB2CStorefrontPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/tienda-b2c")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteB2CStorefrontPage /></LazyRoute></ProtectedRoute>
  );
}
