import { createFileRoute } from "@tanstack/react-router";
import AdminEmailTemplatesPage from "@/pages/admin/AdminEmailTemplatesPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/email-templates")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminEmailTemplatesPage /></LazyRoute></ProtectedRoute>
  );
}
