import { createFileRoute } from "@tanstack/react-router";
import AdminCartAnalytics from "@/pages/admin/AdminCartAnalytics";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/cart-analytics")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminCartAnalytics /> </ProtectedRoute>
  ),
});
