import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerDashboard from "@/pages/seller/SellerDashboard";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerDashboard /></LazyRoute></ProtectedRoute>
  );
}
