import { createFileRoute } from "@tanstack/react-router";
import AdminSupportChats from "@/pages/admin/AdminSupportChats";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/soporte-chat")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}> <AdminSupportChats /> </ProtectedRoute>
  ),
});
