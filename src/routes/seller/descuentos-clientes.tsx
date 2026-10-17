import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerCustomerDiscounts from "@/pages/seller/SellerCustomerDiscounts";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/descuentos-clientes")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerCustomerDiscounts /></LazyRoute></ProtectedRoute>
  );
}
