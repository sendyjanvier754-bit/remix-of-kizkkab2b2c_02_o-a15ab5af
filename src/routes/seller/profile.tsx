import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerProfilePage from "@/pages/seller/SellerProfilePage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerProfilePage /></LazyRoute></ProtectedRoute>
  );
}
