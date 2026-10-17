import { createFileRoute } from "@tanstack/react-router";
import AdminCountriesRoutesPage from "@/pages/admin/AdminCountriesRoutesPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/countries-routes")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <AdminCountriesRoutesPage /> </ProtectedRoute>
  ),
});
