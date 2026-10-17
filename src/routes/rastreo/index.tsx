import { createFileRoute } from "@tanstack/react-router";
import TrackingScanPage from "@/pages/TrackingScanPage";

export const Route = createFileRoute("/rastreo/")({
  component: TrackingScanPage,
});
