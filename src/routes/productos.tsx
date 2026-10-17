import { createFileRoute } from "@tanstack/react-router";
import SearchResultsPage from "@/pages/SearchResultsPage";

export const Route = createFileRoute("/productos")({
  component: SearchResultsPage,
});
