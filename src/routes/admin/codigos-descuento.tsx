import { createFileRoute } from "@tanstack/react-router";
import AdminDiscountCodes from "@/pages/admin/AdminDiscountCodes";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/codigos-descuento")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminDiscountCodes /> </ProtectedRoute>
  ),
});
