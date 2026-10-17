import { createFileRoute } from "@tanstack/react-router";
import AdminTransitHubsPage from "@/pages/admin/AdminTransitHubsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/transit-hubs")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminTransitHubsPage /></LazyRoute></ProtectedRoute>
  );
}
