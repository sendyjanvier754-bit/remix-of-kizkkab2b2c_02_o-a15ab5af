import { createFileRoute } from "@tanstack/react-router";
import UserProfilePage from "@/pages/UserProfilePage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/perfil")({
  component: () => (
    <ProtectedRoute><UserProfilePage /></ProtectedRoute>
  ),
});
