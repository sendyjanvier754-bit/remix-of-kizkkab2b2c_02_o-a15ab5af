import { createFileRoute } from "@tanstack/react-router";
import AdminBrandingPage from "@/pages/admin/AdminBrandingPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/branding")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminBrandingPage /></LazyRoute></ProtectedRoute>
  );
}
