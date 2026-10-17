import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import SiverMatchHub from "@/pages/siver-match/SiverMatchHub";

export const Route = createFileRoute("/siver-match/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><SiverMatchHub /></LazyRoute>
  );
}
