import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import UserNotificationsPage from "@/pages/UserNotificationsPage";

export const Route = createFileRoute("/notificaciones")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute><LazyRoute><UserNotificationsPage /></LazyRoute></ProtectedRoute>
  );
}
