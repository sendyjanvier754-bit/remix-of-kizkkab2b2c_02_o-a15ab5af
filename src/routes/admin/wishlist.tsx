import { createFileRoute } from "@tanstack/react-router";
import AdminWishlistPage from "@/pages/admin/AdminWishlistPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/wishlist")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminWishlistPage /></LazyRoute></ProtectedRoute>
  );
}
