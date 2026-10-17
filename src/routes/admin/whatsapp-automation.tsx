import { createFileRoute } from "@tanstack/react-router";
import AdminWhatsAppAutomationPage from "@/pages/admin/AdminWhatsAppAutomationPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/whatsapp-automation")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminWhatsAppAutomationPage /> </ProtectedRoute>
  ),
});
