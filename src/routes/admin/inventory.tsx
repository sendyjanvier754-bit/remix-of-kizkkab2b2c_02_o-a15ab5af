import { createFileRoute } from "@tanstack/react-router";
import AdminInventoryPage from "@/pages/admin/AdminInventoryPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/inventory")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminInventoryPage /> </ProtectedRoute>
  ),
});
