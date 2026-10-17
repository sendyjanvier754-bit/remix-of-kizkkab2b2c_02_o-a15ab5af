import { createFileRoute } from "@tanstack/react-router";
import AdminEmailDesignerPage from "@/pages/admin/AdminEmailDesignerPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/disenador-email")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><AdminEmailDesignerPage /></ProtectedRoute>
  ),
});
