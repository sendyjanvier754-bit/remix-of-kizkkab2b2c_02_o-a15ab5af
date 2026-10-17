import { createFileRoute } from "@tanstack/react-router";
import InvestorDashboard from "@/pages/siver-match/InvestorDashboard";

export const Route = createFileRoute("/siver-match/investor")({
  component: InvestorDashboard,
});
