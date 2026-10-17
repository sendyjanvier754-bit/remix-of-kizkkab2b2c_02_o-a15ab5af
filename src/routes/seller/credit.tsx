import { createFileRoute } from "@tanstack/react-router";
import SellerCreditPage from "@/pages/seller/SellerCreditPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/credit")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerCreditPage /> </ProtectedRoute>
  ),
});
