import { createFileRoute } from "@tanstack/react-router";
import UserSupportPage from "@/pages/UserSupportPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/soporte")({
  component: () => (
    <ProtectedRoute><UserSupportPage /></ProtectedRoute>
  ),
});
