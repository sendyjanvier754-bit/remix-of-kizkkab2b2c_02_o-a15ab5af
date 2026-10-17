import { createFileRoute } from "@tanstack/react-router";
import SellerCartPage from "@/pages/seller/SellerCartPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/carrito")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerCartPage /> </ProtectedRoute>
  ),
});
