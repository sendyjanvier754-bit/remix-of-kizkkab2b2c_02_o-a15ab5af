import { createFileRoute } from "@tanstack/react-router";
import GrossisteImportPage from "@/pages/grossiste/GrossisteImportPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/grossiste/importar")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteImportPage /></LazyRoute></ProtectedRoute>
  );
}
