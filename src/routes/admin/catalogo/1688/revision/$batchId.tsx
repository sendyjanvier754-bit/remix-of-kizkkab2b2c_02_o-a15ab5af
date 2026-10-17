import { createFileRoute } from "@tanstack/react-router";
import Import1688ReviewPage from "@/pages/admin/Import1688ReviewPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/catalogo/1688/revision/$batchId")({
  component: () => (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}> <Import1688ReviewPage /> </ProtectedRoute>
  ),
});
