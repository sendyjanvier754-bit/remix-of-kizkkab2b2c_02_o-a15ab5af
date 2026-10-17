import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminDashboard /></LazyRoute></ProtectedRoute>
  );
}
