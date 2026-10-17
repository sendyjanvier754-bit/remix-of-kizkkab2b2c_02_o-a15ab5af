import { createFileRoute } from "@tanstack/react-router";
import SellerMarketingPage from "@/pages/seller/SellerMarketingPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/marketing")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerMarketingPage /> </ProtectedRoute>
  ),
});
