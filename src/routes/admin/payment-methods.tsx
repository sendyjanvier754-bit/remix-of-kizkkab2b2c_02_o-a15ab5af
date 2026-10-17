import { createFileRoute } from "@tanstack/react-router";
import AdminPaymentMethodsPage from "@/pages/admin/AdminPaymentMethodsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/payment-methods")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminPaymentMethodsPage /> </ProtectedRoute>
  ),
});
