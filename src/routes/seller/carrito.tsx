import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerCartPage from "@/pages/seller/SellerCartPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/carrito")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerCartPage /></LazyRoute></ProtectedRoute>
  );
}
