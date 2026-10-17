import { createFileRoute } from "@tanstack/react-router";
import AdminEmailCampaignsPage from "@/pages/admin/AdminEmailCampaignsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/email-campaigns")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><AdminEmailCampaignsPage /></ProtectedRoute>
  ),
});
