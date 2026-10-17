import { createFileRoute } from "@tanstack/react-router";
import AdminPartnerApplicationsPage from "@/pages/admin/AdminPartnerApplicationsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/partner-applications")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPartnerApplicationsPage /></LazyRoute></ProtectedRoute>
  );
}
