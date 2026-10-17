import { createFileRoute } from "@tanstack/react-router";
import AdminPopupsPage from "@/pages/admin/AdminPopupsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/popups")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPopupsPage /></LazyRoute></ProtectedRoute>
  );
}
