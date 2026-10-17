import { createFileRoute } from "@tanstack/react-router";
import AdminCartAnalytics from "@/pages/admin/AdminCartAnalytics";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/cart-analytics")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminCartAnalytics /></LazyRoute></ProtectedRoute>
  );
}
