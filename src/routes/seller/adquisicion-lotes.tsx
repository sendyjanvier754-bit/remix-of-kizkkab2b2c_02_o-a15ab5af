import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SellerAcquisicionLotes from "@/pages/seller/SellerAcquisicionLotes";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/seller/adquisicion-lotes")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}><LazyRoute><SellerAcquisicionLotes /></LazyRoute></ProtectedRoute>
  );
}
