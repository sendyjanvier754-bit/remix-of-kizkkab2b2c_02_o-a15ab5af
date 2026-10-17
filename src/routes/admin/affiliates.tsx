import { createFileRoute } from "@tanstack/react-router";
import AdminAffiliatesPage from "@/pages/admin/AdminAffiliatesPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/affiliates")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminAffiliatesPage /></LazyRoute></ProtectedRoute>
  );
}
