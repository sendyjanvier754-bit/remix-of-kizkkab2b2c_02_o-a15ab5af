import { createFileRoute } from "@tanstack/react-router";
import AdminAutomationPage from "@/pages/admin/AdminAutomationPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/automatizaciones")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminAutomationPage /></LazyRoute></ProtectedRoute>
  );
}
