import { createFileRoute } from "@tanstack/react-router";
import SellerMiCatalogoPage from "@/pages/seller/SellerMiCatalogoPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/catalogo")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerMiCatalogoPage /> </ProtectedRoute>
  ),
});
