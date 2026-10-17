import { createFileRoute } from "@tanstack/react-router";
import AdminEmailDesignerPage from "@/pages/admin/AdminEmailDesignerPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/disenador-email")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminEmailDesignerPage /></LazyRoute></ProtectedRoute>
  );
}
