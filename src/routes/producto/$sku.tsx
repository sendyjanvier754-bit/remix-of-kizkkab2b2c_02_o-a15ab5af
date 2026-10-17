import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProductPage from "@/pages/ProductPage";

export const Route = createFileRoute("/producto/$sku")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><ProductPage /></LazyRoute>
  );
}
