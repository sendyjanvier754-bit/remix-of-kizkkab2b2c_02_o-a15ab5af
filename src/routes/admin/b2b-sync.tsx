import { createFileRoute } from "@tanstack/react-router";
import AdminB2BSyncPage from "@/pages/admin/AdminB2BSyncPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/b2b-sync")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminB2BSyncPage /></LazyRoute></ProtectedRoute>
  );
}
