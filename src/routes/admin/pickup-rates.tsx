import { createFileRoute } from "@tanstack/react-router";
import AdminPickupRatesPage from "@/pages/admin/AdminPickupRatesPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/pickup-rates")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPickupRatesPage /></LazyRoute></ProtectedRoute>
  );
}
