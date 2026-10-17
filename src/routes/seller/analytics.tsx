import { createFileRoute } from "@tanstack/react-router";
import SellerAnalyticsPage from "@/pages/seller/SellerAnalyticsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/analytics")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerAnalyticsPage /> </ProtectedRoute>
  ),
});
