import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerInventarioB2C from "@/pages/seller/SellerInventarioB2C";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/inventario")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerInventarioB2C /></LazyRoute></ProtectedRoute>
  );
}
