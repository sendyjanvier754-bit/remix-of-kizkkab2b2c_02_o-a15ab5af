import { createFileRoute } from "@tanstack/react-router";
import CategoryProductsPage from "@/pages/CategoryProductsPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/categoria/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><CategoryProductsPage /></LazyRoute>
  );
}
