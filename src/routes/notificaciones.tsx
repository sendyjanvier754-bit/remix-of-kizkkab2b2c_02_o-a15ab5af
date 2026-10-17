import { createFileRoute } from "@tanstack/react-router";
import UserNotificationsPage from "@/pages/UserNotificationsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/notificaciones")({
  component: () => (
    <ProtectedRoute><UserNotificationsPage /></ProtectedRoute>
  ),
});
