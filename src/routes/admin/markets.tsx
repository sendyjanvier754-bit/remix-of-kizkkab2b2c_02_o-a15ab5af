import { createFileRoute } from "@tanstack/react-router";
import AdminMarketsPage from "@/pages/admin/AdminMarketsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/markets")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminMarketsPage /> </ProtectedRoute>
  ),
});
