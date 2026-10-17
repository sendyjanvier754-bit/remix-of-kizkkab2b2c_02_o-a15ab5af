import { createFileRoute } from "@tanstack/react-router";
import SellerAcquisicionLotes from "@/pages/seller/SellerAcquisicionLotes";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/adquisicion-lotes")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}> <SellerAcquisicionLotes /> </ProtectedRoute>
  ),
});
