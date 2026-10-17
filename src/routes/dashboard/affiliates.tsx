import { createFileRoute } from "@tanstack/react-router";
import AffiliatesDashboardPage from "@/pages/AffiliatesDashboardPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/dashboard/affiliates")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute><LazyRoute><AffiliatesDashboardPage /></LazyRoute></ProtectedRoute>
  );
}
