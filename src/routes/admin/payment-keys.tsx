import { createFileRoute } from "@tanstack/react-router";
import AdminPaymentKeys from "@/pages/admin/AdminPaymentKeys";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/payment-keys")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPaymentKeys /></LazyRoute></ProtectedRoute>
  );
}
