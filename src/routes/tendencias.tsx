import { createFileRoute } from "@tanstack/react-router";
import TrendsPage from "@/pages/TrendsPage";

export const Route = createFileRoute("/tendencias")({
  component: TrendsPage,
});
