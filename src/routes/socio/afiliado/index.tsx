import { createFileRoute } from "@tanstack/react-router";
import InfluencerDashboardPage from "@/pages/partners/influencer/InfluencerDashboardPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/socio/afiliado/")({
  component: () => (
    <ProtectedRoute> <InfluencerDashboardPage /> </ProtectedRoute>
  ),
});
