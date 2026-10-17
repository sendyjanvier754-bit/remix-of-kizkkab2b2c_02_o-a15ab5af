import { createFileRoute } from "@tanstack/react-router";
import AdminAutomationPage from "@/pages/admin/AdminAutomationPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/automatizaciones")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><AdminAutomationPage /></ProtectedRoute>
  ),
});
