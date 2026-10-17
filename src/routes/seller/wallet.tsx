import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerWalletPage from "@/pages/seller/SellerWalletPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/wallet")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerWalletPage /></LazyRoute></ProtectedRoute>
  );
}
