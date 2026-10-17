import { createFileRoute } from "@tanstack/react-router";
import EditProfilePage from "@/pages/EditProfilePage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/editar-perfil")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute><LazyRoute><EditProfilePage /></LazyRoute></ProtectedRoute>
  );
}
