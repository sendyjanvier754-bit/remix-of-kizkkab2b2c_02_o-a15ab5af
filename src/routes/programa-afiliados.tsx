import { createFileRoute } from "@tanstack/react-router";
import InfluencerProgramPage from "@/pages/partners/InfluencerProgramPage";

export const Route = createFileRoute("/programa-afiliados")({
  component: InfluencerProgramPage,
});
