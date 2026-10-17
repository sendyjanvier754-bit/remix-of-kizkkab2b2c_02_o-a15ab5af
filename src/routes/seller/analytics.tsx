import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerAnalyticsPage from "@/pages/seller/SellerAnalyticsPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/analytics")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerAnalyticsPage /></LazyRoute></ProtectedRoute>
  );
}
