import { createFileRoute } from "@tanstack/react-router";
import AdminPopupsPage from "@/pages/admin/AdminPopupsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/popups")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPopupsPage /> </ProtectedRoute>
  ),
});
