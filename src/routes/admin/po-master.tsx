import { createFileRoute } from "@tanstack/react-router";
import AdminPOMasterPage from "@/pages/admin/AdminPOMasterPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/po-master")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPOMasterPage /> </ProtectedRoute>
  ),
});
