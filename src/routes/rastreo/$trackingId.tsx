import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import TrackingScanPage from "@/pages/TrackingScanPage";

export const Route = createFileRoute("/rastreo/$trackingId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><TrackingScanPage /></LazyRoute>
  );
}
