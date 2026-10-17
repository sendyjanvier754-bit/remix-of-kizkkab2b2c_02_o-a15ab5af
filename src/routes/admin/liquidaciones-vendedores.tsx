import { createFileRoute } from "@tanstack/react-router";
import AdminSellerPayouts from "@/pages/admin/AdminSellerPayouts";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/liquidaciones-vendedores")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminSellerPayouts /> </ProtectedRoute>
  ),
});
