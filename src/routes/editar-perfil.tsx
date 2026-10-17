import { createFileRoute } from "@tanstack/react-router";
import EditProfilePage from "@/pages/EditProfilePage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/editar-perfil")({
  component: () => (
    <ProtectedRoute><EditProfilePage /></ProtectedRoute>
  ),
});
