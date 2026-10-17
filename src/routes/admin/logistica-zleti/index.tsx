import { createFileRoute } from "@tanstack/react-router";
import AdminZletiLogisticsPage from "@/pages/admin/AdminZletiLogisticsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/logistica-zleti/")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminZletiLogisticsPage /> </ProtectedRoute>
  ),
});
