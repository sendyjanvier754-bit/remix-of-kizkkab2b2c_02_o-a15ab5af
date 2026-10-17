import { createFileRoute } from "@tanstack/react-router";
import AdminGrossistesPage from "@/pages/admin/AdminGrossistesPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/grossistes")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminGrossistesPage /></LazyRoute></ProtectedRoute>
  );
}
