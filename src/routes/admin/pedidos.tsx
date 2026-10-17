import { createFileRoute } from "@tanstack/react-router";
import AdminPedidos from "@/pages/admin/AdminPedidos";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/pedidos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminPedidos /></LazyRoute></ProtectedRoute>
  );
}
