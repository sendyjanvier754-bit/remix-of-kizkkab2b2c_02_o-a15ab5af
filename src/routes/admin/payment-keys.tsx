import { createFileRoute } from "@tanstack/react-router";
import AdminPaymentKeys from "@/pages/admin/AdminPaymentKeys";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/payment-keys")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPaymentKeys /> </ProtectedRoute>
  ),
});
