import { createFileRoute } from "@tanstack/react-router";
import AdminHubCentralPage from "@/pages/admin/AdminHubCentralPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/hub-central")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminHubCentralPage /> </ProtectedRoute>
  ),
});
