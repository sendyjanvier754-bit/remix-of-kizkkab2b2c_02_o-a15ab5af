import { createFileRoute } from "@tanstack/react-router";
import InfluencerStatsPage from "@/pages/partners/influencer/InfluencerStatsPage";
import LazyRoute from "@/components/LazyRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/socio/afiliado/estadisticas")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute><LazyRoute><InfluencerStatsPage /></LazyRoute></ProtectedRoute>
  );
}
