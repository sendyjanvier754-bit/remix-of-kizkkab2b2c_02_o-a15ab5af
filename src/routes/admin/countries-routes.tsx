import { createFileRoute } from "@tanstack/react-router";
import AdminCountriesRoutesPage from "@/pages/admin/AdminCountriesRoutesPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/countries-routes")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminCountriesRoutesPage /></LazyRoute></ProtectedRoute>
  );
}
