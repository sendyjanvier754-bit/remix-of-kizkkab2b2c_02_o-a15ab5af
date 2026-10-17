import { createFileRoute } from "@tanstack/react-router";
import AdminSellerPayouts from "@/pages/admin/AdminSellerPayouts";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/liquidaciones-vendedores")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminSellerPayouts /></LazyRoute></ProtectedRoute>
  );
}
