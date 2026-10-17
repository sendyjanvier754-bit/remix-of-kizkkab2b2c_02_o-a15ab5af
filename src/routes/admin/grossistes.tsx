import { createFileRoute } from "@tanstack/react-router";
import AdminGrossistesPage from "@/pages/admin/AdminGrossistesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/grossistes")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><AdminGrossistesPage /></ProtectedRoute>
  ),
});
