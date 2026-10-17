import { createFileRoute } from "@tanstack/react-router";
import AdminTrendingStorePage from "@/pages/admin/AdminTrendingStorePage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/tendencias")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.MARKETING]}> <AdminTrendingStorePage /> </ProtectedRoute>
  ),
});
