import { createFileRoute } from "@tanstack/react-router";
import SellerWalletPage from "@/pages/seller/SellerWalletPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/wallet")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerWalletPage /> </ProtectedRoute>
  ),
});
