import { createFileRoute } from "@tanstack/react-router";
import AdminMarketplaceSections from "@/pages/admin/AdminMarketplaceSections";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/marketplace-sections")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminMarketplaceSections /></LazyRoute></ProtectedRoute>
  );
}
