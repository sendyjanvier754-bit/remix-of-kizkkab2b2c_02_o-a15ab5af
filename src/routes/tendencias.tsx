import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import TrendsPage from "@/pages/TrendsPage";

export const Route = createFileRoute("/tendencias")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><TrendsPage /></LazyRoute>
  );
}
