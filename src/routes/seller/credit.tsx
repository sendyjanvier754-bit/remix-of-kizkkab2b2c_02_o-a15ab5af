import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerCreditPage from "@/pages/seller/SellerCreditPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/credit")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerCreditPage /></LazyRoute></ProtectedRoute>
  );
}
