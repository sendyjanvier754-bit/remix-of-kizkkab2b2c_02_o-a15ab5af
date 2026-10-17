import { createFileRoute } from "@tanstack/react-router";
import AdminPaymentMethodsPage from "@/pages/admin/AdminPaymentMethodsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/payment-methods")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPaymentMethodsPage /></LazyRoute></ProtectedRoute>
  );
}
