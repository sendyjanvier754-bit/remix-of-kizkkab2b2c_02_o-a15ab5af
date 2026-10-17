import { createFileRoute } from "@tanstack/react-router";
import SellerProfilePage from "@/pages/seller/SellerProfilePage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/profile")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerProfilePage /> </ProtectedRoute>
  ),
});
