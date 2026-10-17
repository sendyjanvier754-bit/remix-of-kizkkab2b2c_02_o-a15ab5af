import { createFileRoute } from "@tanstack/react-router";
import SiverMatchHub from "@/pages/siver-match/SiverMatchHub";

export const Route = createFileRoute("/siver-match/")({
  component: SiverMatchHub,
});
