import { createFileRoute } from "@tanstack/react-router";
import SellerDiscountCodes from "@/pages/seller/SellerDiscountCodes";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/codigos-descuento")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerDiscountCodes /> </ProtectedRoute>
  ),
});
