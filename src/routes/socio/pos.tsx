import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import PartnerPOsPage from "@/pages/partners/PartnerPOsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/socio/pos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.ZLETI_ADMIN]}><LazyRoute><PartnerPOsPage /></LazyRoute></ProtectedRoute>
  );
}
