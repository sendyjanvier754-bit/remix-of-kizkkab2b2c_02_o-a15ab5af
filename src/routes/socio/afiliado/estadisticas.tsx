import { createFileRoute } from "@tanstack/react-router";
import InfluencerStatsPage from "@/pages/partners/influencer/InfluencerStatsPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/socio/afiliado/estadisticas")({
  component: () => (
    <ProtectedRoute> <InfluencerStatsPage /> </ProtectedRoute>
  ),
});
