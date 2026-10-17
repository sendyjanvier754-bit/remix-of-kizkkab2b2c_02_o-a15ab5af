import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerAccountPage from "@/pages/seller/SellerAccountPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/cuenta")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerAccountPage /></LazyRoute></ProtectedRoute>
  );
}
