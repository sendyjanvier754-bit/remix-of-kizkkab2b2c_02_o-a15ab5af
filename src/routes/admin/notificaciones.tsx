import { createFileRoute } from "@tanstack/react-router";
import NotificationsPage from "@/pages/admin/NotificationsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/notificaciones")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}> <NotificationsPage /> </ProtectedRoute>
  ),
});
