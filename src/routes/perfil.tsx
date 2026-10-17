import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import UserProfilePage from "@/pages/UserProfilePage";

export const Route = createFileRoute("/perfil")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute><LazyRoute><UserProfilePage /></LazyRoute></ProtectedRoute>
  );
}
