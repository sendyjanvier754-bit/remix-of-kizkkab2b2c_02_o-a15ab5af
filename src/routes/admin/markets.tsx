import { createFileRoute } from "@tanstack/react-router";
import AdminMarketsPage from "@/pages/admin/AdminMarketsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/markets")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminMarketsPage /></LazyRoute></ProtectedRoute>
  );
}
