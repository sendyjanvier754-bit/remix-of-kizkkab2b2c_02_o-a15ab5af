import { createFileRoute } from "@tanstack/react-router";
import PartnerPOsPage from "@/pages/partners/PartnerPOsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/pos")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.ZLETI_ADMIN]}> <PartnerPOsPage /> </ProtectedRoute>
  ),
});
