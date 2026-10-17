import { createFileRoute } from "@tanstack/react-router";
import SellerPedidosPage from "@/pages/seller/SellerPedidosPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/pedidos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerPedidosPage /> </ProtectedRoute>
  ),
});
