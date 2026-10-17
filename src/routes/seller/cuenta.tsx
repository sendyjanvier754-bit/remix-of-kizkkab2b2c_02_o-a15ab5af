import { createFileRoute } from "@tanstack/react-router";
import SellerAccountPage from "@/pages/seller/SellerAccountPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/cuenta")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerAccountPage /> </ProtectedRoute>
  ),
});
