import { createFileRoute } from "@tanstack/react-router";
import AdminPickupPointsPage from "@/pages/admin/AdminPickupPointsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/pickup-points")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPickupPointsPage /></LazyRoute></ProtectedRoute>
  );
}
