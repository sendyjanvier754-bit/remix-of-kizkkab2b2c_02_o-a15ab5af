import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import NotificationsPage from "@/pages/admin/NotificationsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/notificaciones")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}><LazyRoute><NotificationsPage /></LazyRoute></ProtectedRoute>
  );
}
