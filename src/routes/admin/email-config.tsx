import { createFileRoute } from "@tanstack/react-router";
import AdminEmailConfigPage from "@/pages/admin/AdminEmailConfigPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/email-config")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminEmailConfigPage /></LazyRoute></ProtectedRoute>
  );
}
