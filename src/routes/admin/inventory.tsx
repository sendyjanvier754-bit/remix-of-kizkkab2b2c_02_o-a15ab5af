import { createFileRoute } from "@tanstack/react-router";
import AdminInventoryPage from "@/pages/admin/AdminInventoryPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/inventory")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminInventoryPage /></LazyRoute></ProtectedRoute>
  );
}
