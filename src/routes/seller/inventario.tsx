import { createFileRoute } from "@tanstack/react-router";
import SellerInventarioB2C from "@/pages/seller/SellerInventarioB2C";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/inventario")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerInventarioB2C /> </ProtectedRoute>
  ),
});
