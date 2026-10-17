import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerMiCatalogoPage from "@/pages/seller/SellerMiCatalogoPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/catalogo")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerMiCatalogoPage /></LazyRoute></ProtectedRoute>
  );
}
