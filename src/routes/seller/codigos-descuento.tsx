import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerDiscountCodes from "@/pages/seller/SellerDiscountCodes";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/codigos-descuento")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerDiscountCodes /></LazyRoute></ProtectedRoute>
  );
}
