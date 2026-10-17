import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import SearchResultsPage from "@/pages/SearchResultsPage";

export const Route = createFileRoute("/busqueda")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><SearchResultsPage /></LazyRoute>
  );
}
