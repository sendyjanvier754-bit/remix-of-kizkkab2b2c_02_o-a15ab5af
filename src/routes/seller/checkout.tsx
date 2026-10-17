import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerCheckout from "@/pages/seller/SellerCheckout";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/checkout")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerCheckout /></LazyRoute></ProtectedRoute>
  );
}
