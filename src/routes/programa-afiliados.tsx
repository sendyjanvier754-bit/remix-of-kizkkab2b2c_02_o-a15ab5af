import { createFileRoute } from "@tanstack/react-router";
import InfluencerProgramPage from "@/pages/partners/InfluencerProgramPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/programa-afiliados")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><InfluencerProgramPage /></LazyRoute>
  );
}
