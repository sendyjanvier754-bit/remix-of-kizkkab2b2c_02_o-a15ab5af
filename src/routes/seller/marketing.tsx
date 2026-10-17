import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerMarketingPage from "@/pages/seller/SellerMarketingPage";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/marketing")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerMarketingPage /></LazyRoute></ProtectedRoute>
  );
}
