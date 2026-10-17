import { createFileRoute } from "@tanstack/react-router";
import AdminHubCentralPage from "@/pages/admin/AdminHubCentralPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/hub-central")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminHubCentralPage /></LazyRoute></ProtectedRoute>
  );
}
