import { createFileRoute } from "@tanstack/react-router";
import InvestorDashboard from "@/pages/siver-match/InvestorDashboard";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/siver-match/investor")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><InvestorDashboard /></LazyRoute>
  );
}
