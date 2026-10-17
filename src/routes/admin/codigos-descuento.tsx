import { createFileRoute } from "@tanstack/react-router";
import AdminDiscountCodes from "@/pages/admin/AdminDiscountCodes";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/codigos-descuento")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminDiscountCodes /></LazyRoute></ProtectedRoute>
  );
}
