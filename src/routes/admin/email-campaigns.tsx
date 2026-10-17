import { createFileRoute } from "@tanstack/react-router";
import AdminEmailCampaignsPage from "@/pages/admin/AdminEmailCampaignsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/email-campaigns")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminEmailCampaignsPage /></LazyRoute></ProtectedRoute>
  );
}
