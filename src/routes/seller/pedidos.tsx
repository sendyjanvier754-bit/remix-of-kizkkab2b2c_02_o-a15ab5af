import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerPedidosPage from "@/pages/seller/SellerPedidosPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/pedidos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerPedidosPage /></LazyRoute></ProtectedRoute>
  );
}
