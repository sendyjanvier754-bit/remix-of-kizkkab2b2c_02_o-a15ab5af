import { createFileRoute } from "@tanstack/react-router";
import InfluencerDashboardPage from "@/pages/partners/influencer/InfluencerDashboardPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/socio/afiliado/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute><LazyRoute><InfluencerDashboardPage /></LazyRoute></ProtectedRoute>
  );
}
