import { createFileRoute } from "@tanstack/react-router";
import AffiliatesDashboardPage from "@/pages/AffiliatesDashboardPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/dashboard/affiliates")({
  component: () => (
    <ProtectedRoute><AffiliatesDashboardPage /></ProtectedRoute>
  ),
});
