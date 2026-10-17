import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import UserSupportPage from "@/pages/UserSupportPage";

export const Route = createFileRoute("/soporte")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute><LazyRoute><UserSupportPage /></LazyRoute></ProtectedRoute>
  );
}
