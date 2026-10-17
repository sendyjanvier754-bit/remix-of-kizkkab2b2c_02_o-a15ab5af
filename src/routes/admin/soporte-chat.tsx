import { createFileRoute } from "@tanstack/react-router";
import AdminSupportChats from "@/pages/admin/AdminSupportChats";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/soporte-chat")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}><LazyRoute><AdminSupportChats /></LazyRoute></ProtectedRoute>
  );
}
