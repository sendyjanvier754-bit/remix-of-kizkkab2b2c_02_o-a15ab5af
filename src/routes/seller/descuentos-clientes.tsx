import { createFileRoute } from "@tanstack/react-router";
import SellerCustomerDiscounts from "@/pages/seller/SellerCustomerDiscounts";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/descuentos-clientes")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerCustomerDiscounts /> </ProtectedRoute>
  ),
});
