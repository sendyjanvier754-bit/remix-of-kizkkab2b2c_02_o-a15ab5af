import { createFileRoute } from "@tanstack/react-router";
import SellerMisComprasPage from "@/pages/seller/SellerMisComprasPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/mis-compras")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerMisComprasPage /> </ProtectedRoute>
  ),
});
