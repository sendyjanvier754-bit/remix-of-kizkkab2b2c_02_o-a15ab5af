import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import MarketplacePage from "@/pages/MarketplacePage";

export const Route = createFileRoute("/marketplace")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><MarketplacePage /></LazyRoute>
  );
}
