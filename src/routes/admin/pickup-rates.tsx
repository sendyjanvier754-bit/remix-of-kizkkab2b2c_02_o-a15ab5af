import { createFileRoute } from "@tanstack/react-router";
import AdminPickupRatesPage from "@/pages/admin/AdminPickupRatesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/pickup-rates")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPickupRatesPage /> </ProtectedRoute>
  ),
});
