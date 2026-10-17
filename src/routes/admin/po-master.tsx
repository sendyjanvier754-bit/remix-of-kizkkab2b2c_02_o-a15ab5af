import { createFileRoute } from "@tanstack/react-router";
import AdminPOMasterPage from "@/pages/admin/AdminPOMasterPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/po-master")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPOMasterPage /></LazyRoute></ProtectedRoute>
  );
}
