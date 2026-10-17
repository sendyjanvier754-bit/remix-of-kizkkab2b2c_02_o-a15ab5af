import { createFileRoute } from "@tanstack/react-router";
import SellerDashboard from "@/pages/seller/SellerDashboard";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/dashboard")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerDashboard /> </ProtectedRoute>
  ),
});
