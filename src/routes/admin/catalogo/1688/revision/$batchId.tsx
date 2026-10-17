import { createFileRoute } from "@tanstack/react-router";
import Import1688ReviewPage from "@/pages/admin/Import1688ReviewPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/catalogo/1688/revision/$batchId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><Import1688ReviewPage /></LazyRoute></ProtectedRoute>
  );
}
