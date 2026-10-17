import { createFileRoute } from "@tanstack/react-router";
import AdminBanners from "@/pages/admin/AdminBanners";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/banners")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminBanners /></LazyRoute></ProtectedRoute>
  );
}
