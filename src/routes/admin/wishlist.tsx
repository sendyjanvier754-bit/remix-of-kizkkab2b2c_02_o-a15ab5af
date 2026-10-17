import { createFileRoute } from "@tanstack/react-router";
import AdminWishlistPage from "@/pages/admin/AdminWishlistPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/wishlist")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminWishlistPage /> </ProtectedRoute>
  ),
});
