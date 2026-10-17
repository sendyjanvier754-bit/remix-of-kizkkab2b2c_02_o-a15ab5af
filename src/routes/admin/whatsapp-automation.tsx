import { createFileRoute } from "@tanstack/react-router";
import AdminWhatsAppAutomationPage from "@/pages/admin/AdminWhatsAppAutomationPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/whatsapp-automation")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminWhatsAppAutomationPage /></LazyRoute></ProtectedRoute>
  );
}
