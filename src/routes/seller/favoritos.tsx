import { createFileRoute } from "@tanstack/react-router";
import SellerFavoritesPage from "@/pages/seller/SellerFavoritesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/favoritos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerFavoritesPage /> </ProtectedRoute>
  ),
});
