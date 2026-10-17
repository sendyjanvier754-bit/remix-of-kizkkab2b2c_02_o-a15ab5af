import { createFileRoute } from "@tanstack/react-router";
import SellerCheckout from "@/pages/seller/SellerCheckout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/checkout")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerCheckout /> </ProtectedRoute>
  ),
});
