import { createFileRoute } from "@tanstack/react-router";
import AdminNewsPage from "@/pages/admin/AdminNewsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";

export const Route = createFileRoute("/admin/noticias")({
  head: () => ({ meta: [{ title: "Noticias | Admin Kizkka" }, { name: "robots", content: "noindex" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.MARKETING]}><LazyRoute><AdminNewsPage /></LazyRoute></ProtectedRoute>
  );
}
