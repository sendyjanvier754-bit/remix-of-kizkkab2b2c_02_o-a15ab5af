import { createFileRoute } from "@tanstack/react-router";
import AdminZletiShippingEstimatePage from "@/pages/admin/AdminZletiShippingEstimatePage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/logistica-zleti/$poId/estimacion-envio")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminZletiShippingEstimatePage /></LazyRoute></ProtectedRoute>
  );
}
