import { createFileRoute } from "@tanstack/react-router";
import AdminTrendingStorePage from "@/pages/admin/AdminTrendingStorePage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/tendencias")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.MARKETING]}><LazyRoute><AdminTrendingStorePage /></LazyRoute></ProtectedRoute>
  );
}
