import { createFileRoute } from "@tanstack/react-router";
import AdminZletiShippingEstimatePage from "@/pages/admin/AdminZletiShippingEstimatePage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/logistica-zleti/$poId/estimacion-envio")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminZletiShippingEstimatePage /> </ProtectedRoute>
  ),
});
