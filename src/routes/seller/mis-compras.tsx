import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerMisComprasPage from "@/pages/seller/SellerMisComprasPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/mis-compras")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerMisComprasPage /></LazyRoute></ProtectedRoute>
  );
}
