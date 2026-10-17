import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerFavoritesPage from "@/pages/seller/SellerFavoritesPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/favoritos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerFavoritesPage /></LazyRoute></ProtectedRoute>
  );
}
